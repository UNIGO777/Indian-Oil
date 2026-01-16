import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DrawPage from './pages/DrawPage.jsx'
import FormPage from './pages/FormPage.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Navigate replace to="/form" />} path="/" />
        <Route element={<FormPage />} path="/form" />
        <Route element={<DrawPage />} path="/draw" />
        <Route element={<Navigate replace to="/form" />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}

export default App
