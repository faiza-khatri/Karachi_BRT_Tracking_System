import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import RouteFinder from './pages/RouteFinder';
import LiveMap    from './pages/LiveMap';

// Protects the dashboard — redirects to login if no token
function PrivateRoute({ children }) {
  const isAuthenticated = localStorage.getItem('adminToken');
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: commuter-facing route finder (home page) */}
        <Route path="/"         element={<RouteFinder />} />

        {/* Public: live bus map */}
        <Route path="/live"     element={<LiveMap />} />

        {/* Public: admin login */}
        <Route path="/login"    element={<Login />} />

        {/* Protected: admin dashboard */}
        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />

        {/* Fallback — redirect anything unknown to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;