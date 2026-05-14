import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './pages/Dashboard';
import DispatcherTools from './pages/DispatcherTools';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedLayout from './pages/ProtectedLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Profile from './pages/Profile';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Chat from './pages/Chat';
import VehicleDetails from './pages/VehicleDetails';
import Vehicles from './pages/Vehicles';
import DriverDashboard from './pages/DriverDashboard';
import { useSocket } from './hooks/useSocket';

export default function App() {
  useSocket();

  return (
    <>
      <ToastContainer position="top-right" autoClose={4000} pauseOnHover />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<ProtectedLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="vehicles/:id" element={<VehicleDetails />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="team" element={<Team />} />
              <Route path="chat" element={<Chat />} />
              <Route path="driver-panel" element={<DriverDashboard />} />
              <Route path="dispatcher-tools" element={<DispatcherTools />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
