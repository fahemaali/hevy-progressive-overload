import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useReloadAfterRefresh } from '../api/useReloadAfterRefresh'
import { BackIcon, BodyIcon, ListIcon } from './icons'
import { Logo } from './Logo'
import { MuscleNav } from './MuscleNav'
import { SearchBar } from './SearchBar'
import styles from './Layout.module.css'

const TABS = [
  { to: '/', label: 'Body map', Icon: BodyIcon, phoneOnly: false },
  // On wide screens the sidebar lists the muscles directly instead.
  { to: '/muscles', label: 'Muscles', Icon: ListIcon, phoneOnly: true },
]

/**
 * The frame around every page. On wide screens: a sidebar with the body map and
 * every muscle you train. On phones: a tab bar along the bottom, and a back button
 * in the header on inner pages.
 */
export function Layout() {
  useReloadAfterRefresh()
  const { pathname } = useLocation()
  const isTopLevel = TABS.some((t) => t.to === pathname)

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <Link to="/" className={styles.sidebarLogo} aria-label="Next Set home">
          <Logo tagline />
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {TABS.map(({ to, label, Icon, phoneOnly }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                [styles.navLink, isActive && styles.active, phoneOnly && styles.phoneOnly]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarMuscles}>
          <h2 className={styles.sidebarHeading}>Muscles</h2>
          <MuscleNav />
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {!isTopLevel && <BackButton />}
            <Link to="/" className={styles.headerLogo} aria-label="Next Set home">
              <Logo />
            </Link>
          </div>
          <SearchBar />
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Back to the previous page; opened directly (e.g. a shared link), back to the body map. */
function BackButton() {
  const navigate = useNavigate()
  const { key } = useLocation()
  return (
    <button
      type="button"
      className={styles.back}
      aria-label="Back"
      onClick={() => void (key === 'default' ? navigate('/') : navigate(-1))}
    >
      <BackIcon />
    </button>
  )
}
