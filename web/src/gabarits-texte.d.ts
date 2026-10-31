/**
 * Gabarits importés en texte par les tests (`import x from './a.html' with { loader: 'text' }`).
 * Seul `tsconfig.spec.json` inclut ce fichier : l'application, elle, n'importe aucun HTML.
 */
declare module '*.html' {
  const contenu: string;
  export default contenu;
}
