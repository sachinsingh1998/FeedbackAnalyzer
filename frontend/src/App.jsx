import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import FeedbackPage from './pages/FeedbackPage'
import GroupsPage from './pages/GroupsPage'
import UploadPage from './pages/UploadPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/feedback/:groupName/:zid" element={<FeedbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
