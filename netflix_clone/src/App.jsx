import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { Account } from './pages/Account.jsx'
import { Home } from './pages/Home.jsx'
import { Login } from './pages/Login.jsx'
import { Logout } from './pages/Logout.jsx'
import { MyNetflix } from './pages/MyNetflix.jsx'
import { NewHot } from './pages/NewHot.jsx'
import { NotFound } from './pages/NotFound.jsx'
import { Placeholder } from './pages/Placeholder.jsx'
import { Search } from './pages/Search.jsx'
import { Signup } from './pages/Signup.jsx'
import { TitleDetail } from './pages/TitleDetail.jsx'
import { useAuth } from './state/authContext.js'
import { LibraryProvider } from './state/LibraryProvider.jsx'

function App() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />
      <Route path="logout" element={<Logout />} />
      <Route element={<RequireAuth />}>
        {/* Keyed by session so each sign-in starts with an empty list, ratings and reviews */}
        <Route element={<LibraryProvider key={session}><Layout /></LibraryProvider>}>
          <Route index element={<Home />} />
          <Route path="title/:id" element={<TitleDetail />} />
          <Route path="search" element={<Search />} />
          <Route path="new" element={<NewHot />} />
          <Route path="my-netflix" element={<MyNetflix />} />
          <Route path="account" element={<Account />} />
          <Route path="games" element={<Placeholder title="Games" />} />
          <Route path="info/:slug" element={<Placeholder />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
