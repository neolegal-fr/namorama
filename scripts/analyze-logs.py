#!/usr/bin/env python3
"""
Analyse des logs NDJSON de production.

Conçu pour être exécuté sur le serveur, qui n'a pas `jq` mais bien python3 :

    ssh namorama-prod "python3 - errors"   < scripts/analyze-logs.py
    ssh namorama-prod "python3 - funnel"   < scripts/analyze-logs.py
    ssh namorama-prod "python3 - rapports" < scripts/analyze-logs.py

Modes :
  errors   — erreurs et avertissements, les plus fréquents d'abord
  funnel   — tunnel de conversion : volumétrie par événement et taux de chute
  rapports — rapports de marque : demandes, issues, et détail par utilisateur
  slow     — requêtes les plus lentes
  http     — répartition des codes de statut par route
  raw      — dernières lignes, brutes
"""
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from glob import glob

LOG_GLOB = "/var/snap/docker/common/namorama/logs/api/app-*.ndjson"

# Message générique du routeur pour une route inexistante (« Cannot GET /1.php »).
# Un 404 métier porte un message propre et n'est donc pas filtré.
SCAN_MESSAGE = re.compile(r"^Cannot [A-Z]+ ")

# Ordre du tunnel : chaque étape suppose la précédente franchie.
FUNNEL = [
    # Le seul événement qui compte une VISITE, donc le seul dénominateur : sans
    # lui, un visiteur qui arrive, lit et repart ne laisse aucune trace. Le
    # tableau de bord en tient le compte durable (table `visitor_session`) ;
    # ici, on ne voit que les 30 derniers jours.
    ("page_viewed", "Page affichée"),
    ("wizard_step_viewed", "Étape du wizard vue"),
    ("login_required_before_search", "Redirigé vers la connexion"),
    ("search_blocked_validation", "Refusé avant départ : saisie invalide"),
    ("search_started", "Recherche lancée"),
    ("search_completed", "Recherche terminée"),
    ("search_blocked_no_credits", "Bloqué : crédits épuisés"),
    ("search_cancelled_by_user", "Recherche interrompue"),
    ("search_failed", "Recherche en échec"),
    ("no_result_relax_clicked", "A assoupli la longueur"),
    ("brand_report_requested", "Rapport de marque demandé"),
    ("brand_report_generated", "Rapport de marque produit"),
    ("brand_report_cache_hit", "Rapport déjà en cache (non refacturé)"),
    ("brand_report_blocked_no_credits", "Rapport bloqué : crédits épuisés"),
    ("brand_report_failed", "Rapport en échec"),
    ("client_error", "Erreur JavaScript subie"),
]

# Parcours « j'ai déjà un nom » : de la page publique au projet.
# Il ne passe par AUCUNE des étapes du tunnel ci-dessus — le suivre avec les
# mêmes repères donnerait un entonnoir vide et un chemin invisible.
NAME_FUNNEL = [
    ("public_report_requested", "Nom saisi sur la page publique"),
    ("public_report_shown", "Verdict domaines affiché"),
    ("public_report_failed", "Vérification publique en échec"),
    ("public_report_sample_viewed", "Exemple de rapport consulté"),
    ("public_report_signup_clicked", "A cliqué « créer mon compte »"),
    ("public_report_verify_clicked", "A cliqué « vérifier marques et réseaux »"),
    ("public_report_project_clicked", "A demandé des suggestions"),
    ("name_test_started", "Création de projet lancée"),
    ("name_test_project_created", "Projet créé depuis le nom"),
    ("name_test_failed", "Création de projet en échec"),
    ("report_locked_abandoned", "A quitté le rapport sans acheter"),
]

# Issues possibles d'une demande de rapport, dans l'ordre d'apparition.
REPORT_OUTCOMES = [
    ("brand_report_generated", "produits"),
    ("brand_report_cache_hit", "déjà en cache"),
    ("brand_report_blocked_no_credits", "bloqués (crédits)"),
    ("brand_report_failed", "en échec"),
]


def load(pattern=LOG_GLOB):
    rows = []
    for path in sorted(glob(pattern)):
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue  # ligne tronquée par une rotation : sans importance
    return rows


def is_scan(row):
    """Requête d'un scanner, jamais d'un utilisateur.

    Deux formes, et la seconde a mis du temps à se voir :

    * une route inexistante (« Cannot GET /1.php ») ;
    * un 401 sur la RACINE de l'API, avec ou sans paramètres. Aucun écran du
      produit n'appelle « / » — le front tape des routes nommées, et la racine
      n'est servie que par nginx. Ce qui frappe là, ce sont des sondes
      WordPress et PHP (« /?rest_route=/wp/v2/users/ », « /?phpinfo=1 ») :
      61 lignes sur 7 jours en septembre 2026, soit 84 % de ce que ce mode
      affichait.

    Un 401 sur une route NOMMÉE, lui, se garde : c'est une session expirée,
    donc un blocage réellement vécu — exactement ce que ce mode cherche.
    """
    if row.get("status") == 404 and SCAN_MESSAGE.match(str(row.get("message") or "")):
        return True
    chemin = str(row.get("path") or "")
    return row.get("status") == 401 and (chemin == "/" or chemin.startswith("/?"))


def errors(rows):
    bad = [r for r in rows if r.get("level") in ("error", "warn")]
    # Les logs antérieurs au correctif classaient ces lignes en `warn` : elles
    # représentaient 98 % du volume et rendaient ce mode inutilisable. On les
    # écarte ici aussi, mais on annonce le nombre — les taire silencieusement
    # se lirait comme « il n'y avait rien ».
    scans = [r for r in bad if is_scan(r)]
    bad = [r for r in bad if not is_scan(r)]
    print(f"{len(bad)} erreurs / avertissements")
    if scans:
        print(f"({len(scans)} sondages de robots écartés — mode `http` pour les voir)")
    print()
    grouped = Counter(
        (r.get("context"), str(r.get("message"))[:110], r.get("status")) for r in bad
    )
    for (ctx, msg, status), n in grouped.most_common(25):
        print(f"  {n:5}×  [{ctx}] {status or ''} {msg}")


def funnel(rows):
    events = Counter(r.get("context") for r in rows if r.get("kind") == "event")
    print("Volumétrie des étapes\n")
    for name, label in FUNNEL:
        print(f"  {events.get(name, 0):6}  {label}  ({name})")

    autres = {k: v for k, v in events.items() if k not in dict(FUNNEL)}
    if autres:
        print("\n  Autres événements :")
        for k, v in sorted(autres.items(), key=lambda kv: -kv[1]):
            print(f"  {v:6}  {k}")

    started = events.get("search_started", 0)
    completed = events.get("search_completed", 0)
    blocked = events.get("search_blocked_validation", 0)
    # Le dénominateur compte les tentatives, pas les départs : une recherche
    # refusée par la validation n'atteint jamais le contrôleur, donc n'émet
    # aucun `search_started`. L'ignorer afficherait 100 % de réussite sur un
    # parcours où l'utilisateur s'est heurté à un mur.
    tentatives = started + blocked
    if tentatives:
        print(f"\n  Recherches abouties : {completed}/{tentatives} ({100*completed/tentatives:.0f} %)")
    if blocked:
        print(f"  Refusées avant même de démarrer : {blocked}/{tentatives} ({100*blocked/tentatives:.0f} %)")
        motifs = Counter(
            str(r.get("reason"))[:70]
            for r in rows if r.get("context") == "search_blocked_validation"
        )
        for motif, n in motifs.most_common(5):
            print(f"      {n:4}×  {motif}")

    vides = sum(1 for r in rows if r.get("context") == "search_completed" and r.get("emptyResult"))
    if completed:
        print(f"  Recherches sans aucun résultat : {vides}/{completed} ({100*vides/completed:.0f} %)")

    # Sessions ayant vu une étape mais n'ayant jamais lancé de recherche.
    vues, lancees = set(), set()
    for r in rows:
        sid = r.get("sessionId")
        if not sid:
            continue
        if r.get("context") == "wizard_step_viewed":
            vues.add(sid)
        if r.get("context") in ("search_started", "login_required_before_search"):
            lancees.add(sid)
    if vues:
        perdus = len(vues - lancees)
        print(f"  Sessions entrées dans le wizard sans aller jusqu'à la recherche : "
              f"{perdus}/{len(vues)} ({100*perdus/len(vues):.0f} %)")


def rapports(rows):
    """Rapports de marque : volumétrie, issues, et détail par utilisateur."""
    events = [r for r in rows if r.get("kind") == "event"]
    demandes = [r for r in events if r.get("context") == "brand_report_requested"]
    par_issue = Counter(r.get("context") for r in events)

    total = len(demandes)
    print(f"Rapports de marque — {total} demande(s)\n")

    for name, label in REPORT_OUTCOMES:
        n = par_issue.get(name, 0)
        part = f"  ({100*n/total:.0f} %)" if total else ""
        print(f"  {n:6}  {label}{part}")

    # Crédits réellement débités : on somme le `cost` porté par chaque événement
    # plutôt que de multiplier par le tarif courant. Le coût a changé au fil du
    # temps (500 → 50 crédits) ; un tarif unique fausserait tout l'historique.
    debites = sum(
        r.get("cost", 0) for r in events
        if r.get("context") == "brand_report_generated" and isinstance(r.get("cost"), int)
    )
    print(f"\n  Crédits débités au total : {debites}")

    forces = sum(1 for r in demandes if r.get("forced"))
    if forces:
        print(f"  Régénérations forcées : {forces}/{total}")

    # Détail par compte. La clé est le `sub` Keycloak — le seul identifiant
    # journalisé (ni email ni nom, cf. règles de logs).
    par_user = defaultdict(Counter)
    credits_user = Counter()
    for r in events:
        sub, ctx = r.get("sub"), r.get("context")
        if not sub or not str(ctx).startswith("brand_report_"):
            continue
        par_user[sub][ctx] += 1
        if ctx == "brand_report_generated" and isinstance(r.get("cost"), int):
            credits_user[sub] += r["cost"]

    if not par_user:
        print("\n  Aucune demande attribuée à un compte.")
        return

    print(f"\nDétail par utilisateur ({len(par_user)} compte(s))\n")
    print(f"  {'compte (sub)':38} {'dem.':>5} {'prod.':>6} {'cache':>6} {'bloq.':>6} {'éch.':>5} {'crédits':>8}")
    ordre = sorted(
        par_user.items(),
        key=lambda kv: (-kv[1].get("brand_report_requested", 0), -sum(kv[1].values())),
    )
    for sub, c in ordre:
        print(
            f"  {str(sub)[:38]:38} "
            f"{c.get('brand_report_requested', 0):>5} "
            f"{c.get('brand_report_generated', 0):>6} "
            f"{c.get('brand_report_cache_hit', 0):>6} "
            f"{c.get('brand_report_blocked_no_credits', 0):>6} "
            f"{c.get('brand_report_failed', 0):>5} "
            f"{credits_user.get(sub, 0):>8}"
        )

    # `brand_report_requested` n'existe que depuis l'ajout du traçage des
    # demandes : sur les logs antérieurs, la colonne « dem. » reste à 0 alors
    # que des rapports ont bien été produits. Le signaler évite de lire ça
    # comme une anomalie.
    issues = sum(par_issue.get(n, 0) for n, _ in REPORT_OUTCOMES)
    if total < issues:
        print(f"\n  Note : {issues} issue(s) pour {total} demande(s) tracée(s).")
        print("  Les logs antérieurs au traçage des demandes n'ont pas d'événement")
        print("  `brand_report_requested` — seule leur issue est comptée.")


def slow(rows):
    http = [r for r in rows if r.get("kind") == "http" and isinstance(r.get("durationMs"), int)]
    http.sort(key=lambda r: -r["durationMs"])
    print("Requêtes les plus lentes\n")
    for r in http[:25]:
        print(f"  {r['durationMs']:7} ms  {r['method']:5} {r.get('path')}  → {r.get('status')}")


def http(rows):
    by_route = defaultdict(Counter)
    for r in rows:
        if r.get("kind") == "http":
            by_route[f"{r['method']} {r.get('path')}"][r.get("status")] += 1
    print("Codes de statut par route\n")
    for route, statuses in sorted(by_route.items(), key=lambda kv: -sum(kv[1].values())):
        detail = "  ".join(f"{s}:{n}" for s, n in sorted(statuses.items(), key=lambda kv: str(kv[0])))
        print(f"  {sum(statuses.values()):6}  {route:42} {detail}")


# Les notices d'un rapport partent EN PARALLÈLE : leurs en-têtes reviennent
# dans un ordre qui n'est pas celui du compteur, et le journal les enregistre
# dans la même seconde. Observé le 01/09/2026 : « 94 » puis « 95 », lu comme
# une remise à zéro alors que rien n'avait repris. Deux observations aussi
# rapprochées ne peuvent pas encadrer une période de quota — qui se compte en
# heures, sinon en jours.
FENETRE_SIMULTANEE = timedelta(seconds=5)


def _instant(ts):
    """L'horodatage ISO en `datetime`, ou `None` s'il est illisible."""
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _simultanes(a, b):
    """Deux observations trop rapprochées pour encadrer une remise à zéro."""
    return a is not None and b is not None and abs(b - a) <= FENETRE_SIMULTANEE


def quota(rows):
    """Évolution du quota INPI dans le temps — et donc, à l'usage, sa période.

    La passerelle ne dit nulle part quand son compteur repart : pas d'en-tête
    `x-rate-limit-reset`, rien dans l'OpenAPI, rien dans la documentation. La
    seule façon de connaître la période est de regarder QUAND la valeur remonte.
    D'où l'affichage chronologique, avec la remontée signalée explicitement.
    """
    obs = [r for r in rows if r.get("context") == "trademark_quota_observed"]
    if not obs:
        print("Aucune observation de quota INPI.")
        print("Le compteur n'est lu que sur les appels de diffusion (recherche, notice) :")
        print("aucune trace signifie qu'aucun rapport de marque n'a été produit sur la période.")
        return

    print(f"Quota INPI — {len(obs)} appels observés\n")
    print(f"{'horodatage':<22} {'appel':<8} {'restant':>8}  {'Mo restants':>12}")
    prev = None
    resets = []
    for r in obs:
        rem = r.get("remaining")
        by = r.get("bytesRemaining")
        mo = f"{by / 1_000_000:.1f}" if isinstance(by, (int, float)) else "-"
        instant = _instant(r.get("ts"))
        flag = ""
        monte = prev is not None and isinstance(rem, int) and rem > prev[1]
        if monte and not _simultanes(prev[2], instant):
            flag = f"  ← REMISE À ZÉRO (dernier appel : {prev[0]})"
            resets.append((prev[0], str(r.get("ts"))[:19]))
        print(f"{str(r.get('ts'))[:19]:<22} {str(r.get('endpoint')):<8} {str(rem):>8}  {mo:>12}{flag}")
        if isinstance(rem, int):
            prev = (str(r.get("ts"))[:19], rem, instant)

    print()
    if resets:
        print("Remises à zéro observées (la période tombe entre ces deux bornes) :")
        for before, after in resets:
            print(f"  après {before}  →  avant {after}")
    else:
        print("Aucune remise à zéro observée : la période dépasse l'intervalle couvert ici.")

    low = [r for r in rows if r.get("context") == "trademark_quota_low"]
    if low:
        print(f"\n{len(low)} alerte(s) « quota presque épuisé » — dernière : {str(low[-1].get('ts'))[:19]}")


def nom(rows):
    """Parcours de qui arrive avec un nom en tête.

    Distinct du tunnel de génération : ce visiteur ne décrit pas de projet, il
    veut un verdict. Le suivre avec les repères de l'autre entonnoir donnerait
    une colonne vide et un chemin invisible.
    """
    total = {}
    for cle, libelle in NAME_FUNNEL:
        total[cle] = sum(1 for r in rows if r.get("context") == cle)

    print("Parcours « j'ai déjà un nom »\n")
    depart = total.get("public_report_requested", 0)
    for cle, libelle in NAME_FUNNEL:
        n = total[cle]
        part = f"{100 * n / depart:5.1f} %" if depart else "     —"
        print(f"  {libelle:<44} {n:>6}  {part}")

    if depart:
        crees = total.get("name_test_project_created", 0)
        print(f"\nDe la saisie au projet créé : {100 * crees / depart:.1f} %")
        perdus = depart - total.get("public_report_shown", 0)
        if perdus > 0:
            print(f"⚠ {perdus} saisie(s) sans verdict affiché — vérifier `public_report_failed`.")

    abandons = total.get("report_locked_abandoned", 0)
    if abandons:
        print(f"\n{abandons} départ(s) du rapport sans achat : c'est là que le prix se discute.")


def raw(rows):
    for r in rows[-30:]:
        print(json.dumps(r, ensure_ascii=False)[:220])


MODES = {
    "errors": errors,
    "funnel": funnel,
    "rapports": rapports,
    "quota": quota,
    "nom": nom,
    "slow": slow,
    "http": http,
    "raw": raw,
}

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "funnel"
    if mode not in MODES:
        print(f"Mode inconnu. Disponibles : {', '.join(MODES)}")
        sys.exit(1)
    data = load()
    if not data:
        print(f"Aucun log trouvé dans {LOG_GLOB}")
        sys.exit(0)
    print(f"— {len(data)} lignes analysées —\n")
    MODES[mode](data)
