import React, { useEffect, useState } from "react";
import {
    ExclamationTriangleFill,
    CheckCircleFill,
    InfoCircleFill,
    XCircleFill,
} from "react-bootstrap-icons";
import {
    fetchSpendingAlerts,
    type SpendingAlert,
} from "../services/alert.service";

const DashboardAlertBanner: React.FC = () => {
    // Alerts disabled - not needed in UI
    return null;
};

export default DashboardAlertBanner;
