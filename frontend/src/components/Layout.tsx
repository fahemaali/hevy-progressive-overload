import { Link, NavLink, Outlet } from 'react-router'
import { useReloadAfterRefresh } from '../api/useReloadAfterRefresh'
import { BodyIcon } from './icons'
import { Logo } from './Logo'
import { SearchBar } from './SearchBar'
import styles from './Layout.module.css'

const NAV = [{ to: '/', label: 'Body map', Icon: BodyIcon }]

/**
 * The frame around every page. On wide screens the navigation is a sidebar;
 * on phones the same links become a tab bar along the bottom (shown once there's
 * more than one section to switch between).
 */
export function Layout() {
  useReloadAfterRefresh()

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} data-single={NAV.length < 2 || undefined}>
        <Link to="/" className={styles.sidebarLogo} aria-label="Next Set home">
          <Logo tagline />
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className={styles.content}>
        <header className={styles.header}>
          <Link to="/" className={styles.headerLogo} aria-label="Next Set home">
            <Logo />
          </Link>
          <SearchBar />
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
