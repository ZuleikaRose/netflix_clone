import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { Account } from './pages/Account.jsx'
import { ForgotPassword } from './pages/ForgotPassword.jsx'
import { Home } from './pages/Home.jsx'
import { InfoPage } from './pages/InfoPage.jsx'
import { Login } from './pages/Login.jsx'
import { Logout } from './pages/Logout.jsx'
import { MyNetflix } from './pages/MyNetflix.jsx'
import { NewHot } from './pages/NewHot.jsx'
import { NotFound } from './pages/NotFound.jsx'
import { ResetPassword } from './pages/ResetPassword.jsx'
import { Games } from './pages/Games.jsx'
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
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route element={<RequireAuth />}>
        {/* Keyed by session so each sign-in starts with an empty list, ratings and reviews */}
        <Route element={<LibraryProvider key={session}><Layout /></LibraryProvider>}>
          <Route index element={<Home />} />
          <Route path="title/:id" element={<TitleDetail />} />
          <Route path="search" element={<Search />} />
          <Route path="new" element={<NewHot />} />
          <Route path="my-netflix" element={<MyNetflix />} />
          <Route path="watchlist" element={<MyNetflix />} />
          <Route path="favorites" element={<MyNetflix />} />
          <Route path="account" element={<Account />} />
          <Route path="games" element={<Games />} />
          <Route path="games/:gameId" element={<Games />} />
          <Route path="info/:slug" element={<InfoPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
