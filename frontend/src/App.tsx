import { Routes, Route } from "react-router-dom";
import StartPage from "./pages/StartPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AnalisisPage from "./pages/AnalisisPage";
import TargetPage from "./pages/TargetMenabungPage";
import SettingsPage from "./pages/SettingsPage";
import PrivateRoute from "./routes/PrivateRoute";
import ApprovalPage from "./pages/ApprovalPage";
import FamilyPage from "./pages/FamilyPage";
import AIChatBox from "./components/AIChatBox";

function App() {
    return (
        <div className="App">
            <Routes>
                {/* Rute Publik */}
                <Route path="/" element={<StartPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Rute Terproteksi */}
                <Route element={<PrivateRoute />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/analisis" element={<AnalisisPage />} />
                    <Route path="/target" element={<TargetPage />} />
                    <Route path="/approval" element={<ApprovalPage />} />
                    <Route path="/family" element={<FamilyPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Route>
            </Routes>
            <AIChatBox />
        </div>
    );
}

export default App;
