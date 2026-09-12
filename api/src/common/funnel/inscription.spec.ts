import { FunnelService } from './funnel.service';
import { UsersService } from '../../users/users.service';

/**
 * L'inscription de l'entonnoir : un fait daté, pas une course.
 *
 * Ces deux blocs fixent les deux moitiés du même incident de septembre 2026.
 * Au chargement de l'application, une dizaine d'appels authentifiés partent
 * ensemble et passent tous par `findOrCreate` sur un `sub` encore inconnu :
 *
 * - celui qui gagnait créait le compte et gardait `cree` pour lui, si bien que
 *   la marche « compte créé » n'était marquée que si le gagnant se trouvait
 *   être l'un des deux appels de `UsersController` — 2 fois sur 9 en
 *   production ;
 * - ceux qui perdaient remontaient un 500 « Duplicate entry ».
 */
describe('Entonnoir — inscription', () => {
  describe('FunnelService.rattacher', () => {
    function fabrique() {
      const query = jest.fn().mockResolvedValue(undefined);
      const service = new FunnelService({ query } as any);
      return { service, query };
    }

    const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    it('laisse la base trancher sur les dates, sans consulter l’appel en cours', async () => {
      const { service, query } = fabrique();
      const creeA = new Date('2026-09-08T12:23:47.700Z');

      // `false` : cet appel-ci n'a PAS créé le compte — c'est le cas des sept
      // inscriptions manquées. Le marquage ne doit pas en dépendre.
      await service.rattacher(SESSION, 'sub-1', creeA, false);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('GREATEST(accountCreated, IFNULL(? >= firstSeenAt, 0))');
      // La date du compte est ce qui décide, et elle est bien transmise.
      expect(params).toContain(creeA);
    });

    it('n’écrase jamais un drapeau déjà levé', async () => {
      const { service, query } = fabrique();
      await service.rattacher(SESSION, 'sub-1', new Date(), false);
      const [sql] = query.mock.calls[0];
      // Sans GREATEST, un second appel au cours de la même visite remettrait
      // l'inscription à zéro dès que la comparaison de dates redevient fausse.
      expect(sql).toContain('GREATEST(');
      expect(sql).not.toMatch(/accountCreated\s*=\s*0/);
    });

    it('ne rattache rien sans identifiant de session exploitable', async () => {
      const { service, query } = fabrique();
      await service.rattacher(undefined, 'sub-1', new Date(), true);
      await service.rattacher('court', 'sub-1', new Date(), true);
      expect(query).not.toHaveBeenCalled();
    });

    it('n’écrit qu’une fois par visite', async () => {
      const { service, query } = fabrique();
      await service.rattacher(SESSION, 'sub-1', new Date(), true);
      await service.rattacher(SESSION, 'sub-1', new Date(), false);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('UsersService.findOrCreateDetaille', () => {
    /**
     * @param perdant l'insertion échoue sur l'index unique, comme pour l'appel
     *   arrivé seconde sur un `sub` neuf.
     */
    function fabrique(perdant: boolean) {
      const gagnant = { id: 7, keycloakId: 'sub-neuf', createdAt: new Date() };
      const findOne = jest
        .fn()
        // Premier passage : personne, on tente donc la création.
        .mockResolvedValueOnce(null)
        // Relecture après l'échec : la ligne du gagnant.
        .mockResolvedValue(gagnant);

      const save = perdant
        ? jest.fn().mockRejectedValueOnce(
            Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }),
          )
        : jest.fn().mockImplementation(async (u: any) => u);

      const service = Object.create(UsersService.prototype) as any;
      service.usersRepository = { findOne, create: (u: any) => u, save };
      service.activityRepository = {
        createQueryBuilder: () => ({
          insert: () => ({ into: () => ({ values: () => ({ orIgnore: () => ({ execute: async () => undefined }) }) }) }),
        }),
      };
      service.logger = { warn: jest.fn(), error: jest.fn() };
      return { service, gagnant, save };
    }

    it('le perdant de la course relit la ligne du gagnant au lieu de remonter un 500', async () => {
      const { service, gagnant } = fabrique(true);
      const { user, cree } = await service.findOrCreateDetaille('sub-neuf', {});
      expect(user).toBe(gagnant);
      // Il n'a pas créé le compte : le dire aurait compté l'inscription deux fois.
      expect(cree).toBe(false);
    });

    it('une insertion qui échoue sans ligne à relire reste une erreur', async () => {
      const { service } = fabrique(true);
      service.usersRepository.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.findOrCreateDetaille('sub-neuf', {})).rejects.toThrow('Duplicate entry');
    });

    it('le gagnant, lui, signale bien une création', async () => {
      const { service } = fabrique(false);
      const { cree } = await service.findOrCreateDetaille('sub-neuf', {});
      expect(cree).toBe(true);
    });
  });
});
