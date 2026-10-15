import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import Shell from "@/components/Shell";
import { adminApi, clearToken, getToken, onSessionExpired, type AdminMe } from "@/lib/api";
import Admins from "@/pages/Admins";
import AIOperations from "@/pages/AIOperations";
import Audit from "@/pages/Audit";
import Billing from "@/pages/Billing";
import Catalogue from "@/pages/Catalogue";
import Comms from "@/pages/Comms";
import Feedback from "@/pages/Feedback";
import Forms from "@/pages/Forms";
import Integrations from "@/pages/Integrations";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Pipelines from "@/pages/Pipelines";
import Security from "@/pages/Security";
import Stub from "@/pages/Stub";
import Trust from "@/pages/Trust";
import Users from "@/pages/Users";

export default function App() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [checked, setChecked] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setChecked(true);
      return;
    }
    try {
      setMe(await adminApi.me());
    } catch {
      clearToken();
      setMe(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => onSessionExpired(() => { setSessionExpired(true); setMe(null); }), []);

  if (!checked) return null;
  if (!me) return <Login onSignedIn={() => { setSessionExpired(false); void refresh(); }} expiredNotice={sessionExpired} />;

  return (
    <Router>
      <Shell me={me} onSignedOut={() => setMe(null)}>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/users" element={<Users />} />
          <Route path="/pipelines" element={<Pipelines />} />
          <Route path="/security" element={<Security />} />
          <Route path="/catalogue" element={<Catalogue />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/comms" element={<Comms />} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/admins" element={<Admins />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/trust" element={<Trust />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/ai" element={<AIOperations />} />
          <Route path="/:moduleId" element={<Stub />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Shell>
    </Router>
  );
}
