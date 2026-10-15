import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { Home } from './pages/Home.jsx'
import { MyNetflix } from './pages/MyNetflix.jsx'
import { NewHot } from './pages/NewHot.jsx'
import { NotFound } from './pages/NotFound.jsx'
import { Placeholder } from './pages/Placeholder.jsx'
import { Search } from './pages/Search.jsx'
import { TitleDetail } from './pages/TitleDetail.jsx'
import { LibraryProvider } from './state/LibraryProvider.jsx'

function App() {
  return (
    <LibraryProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="title/:id" element={<TitleDetail />} />
          <Route path="search" element={<Search />} />
          <Route path="new" element={<NewHot />} />
          <Route path="my-netflix" element={<MyNetflix />} />
          <Route path="games" element={<Placeholder title="Games" />} />
          <Route path="info/:slug" element={<Placeholder />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </LibraryProvider>
  )
}

export default App
