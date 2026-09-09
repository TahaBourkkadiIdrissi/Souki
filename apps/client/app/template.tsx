// Transition de page facon app native : le contenu se fond a chaque navigation.
// template.tsx est re-monte par Next a chaque changement de route, donc
// l'animation `.page-enter` rejoue automatiquement.
// On anime uniquement l'opacite (pas de transform) pour ne PAS creer de
// containing block qui casserait les `position: fixed` (sidebar admin, etc.).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
