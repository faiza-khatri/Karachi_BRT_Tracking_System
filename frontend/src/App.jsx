// import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import Login from './pages/login';
// import Dashboard from './pages/dashboard';

// function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<Login />} />
//         <Route path="/dashboard" element={<Dashboard />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RouteFinder from './pages/RouteFinder';

// Simple auth guard — checks if admin session token exists in localStorage
function PrivateRoute({ children }) {
  const isAuthenticated = localStorage.getItem('adminToken');
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: commuter-facing route finder */}
        <Route path="/" element={<RouteFinder />} />

        {/* Public: admin login */}
        <Route path="/login" element={<Login />} />

        {/* Protected: admin dashboard */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;