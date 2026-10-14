import { Navigate, Route, Routes } from "react-router-dom";
import { OperatorLayout } from "./OperatorLayout";
import { OrganizationDetail } from "./OrganizationDetail";
import { Organizations } from "./Organizations";
import { Overview } from "./Overview";
import { Users } from "./Users";

/** The whole operator console, loaded as one lazy chunk so ordinary users never download it. */
export default function OperatorApp() {
  return (
    <Routes>
      <Route element={<OperatorLayout />}>
        <Route index element={<Overview />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="organizations/:id" element={<OrganizationDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="*" element={<Navigate to="/operator" replace />} />
      </Route>
    </Routes>
  );
}
