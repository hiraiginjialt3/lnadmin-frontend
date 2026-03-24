// components/ProtectedEmployeeRoute.jsx
import { Navigate } from 'react-router-dom';

const ProtectedEmployeeRoute = ({ children }) => {
  const employee = JSON.parse(localStorage.getItem('employee'));
  const token = localStorage.getItem('employeeAuthToken');

  if (!employee || !token) {
    // Redirect to employee login if not authenticated
    return <Navigate to="/employee/login" replace />;
  }

  return children;
};

export default ProtectedEmployeeRoute;