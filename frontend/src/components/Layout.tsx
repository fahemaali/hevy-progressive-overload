import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { useReloadAfterRefresh } from '../api/useReloadAfterRefresh'
import { BackIcon, BodyIcon, DumbbellIcon, InfoIcon, ListIcon } from './icons'
import { Logo } from './Logo'
import { SearchBar } from './SearchBar'
import { SidebarNav } from './SidebarNav'
import styles from './Layout.module.css'

const TABS = [
  { to: '/', label: 'Body map', Icon: BodyIcon },
  { to: '/muscles', label: 'Muscles', Icon: ListIcon },
  { to: '/exercises', label: 'Exercises', Icon: DumbbellIcon },
  { to: '/about', label: 'About', Icon: InfoIcon },
]

/**
 * The frame around every page. Wide screens: a sidebar with collapsible Muscles and
 * Exercises sections. Phones: a tab bar along the bottom, and a back button in the
 * header on inner pages.
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
        <SidebarNav />
      </aside>

      <nav aria-label="Main" className={styles.tabbar}>
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

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
        {/* New pages open at the top; going back returns to where you were. */}
        <ScrollRestoration />
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
