import React from 'react';
import { CampaignProvider, useCampaign } from './context/CampaignContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

function AppContent() {
  const { user } = useCampaign();

  if (!user) {
    return <Login />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <CampaignProvider>
      <AppContent />
    </CampaignProvider>
  );
}
