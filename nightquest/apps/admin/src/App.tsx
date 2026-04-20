import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { clearToken, adminApi, getToken, setToken, decodeToken } from './api';
import { Badge } from './components/ui/Badge';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { EmptyState } from './components/ui/EmptyState';
import { Input } from './components/ui/Input';
import { CitiesPage } from './pages/CitiesPage';
import { PlacesPage } from './pages/PlacesPage';
import { TonesPage } from './pages/TonesPage';
import { MissionsPage } from './pages/MissionsPage';
import { SystemPromptPage } from './pages/SystemPromptPage';
import { SessionsPage } from './pages/SessionsPage';
import { UsersPage } from './pages/UsersPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { GenerationWizardPage } from './pages/GenerationWizardPage';
import { GenerationProposalsPage } from './pages/GenerationProposalsPage';
import { GenerationProposalDetailPage } from './pages/GenerationProposalDetailPage';

type Screen =
  | 'dashboard'
  | 'cities'
  | 'places'
  | 'tones'
  | 'missions'
  | 'system-prompt'
  | 'sessions'
  | 'users'
  | 'design-system'
  | 'generation-new'
  | 'generation-proposals'
  | 'generation-proposal-detail';

const NAV: Array<[Screen, string]> = [
  ['dashboard', 'Dashboard'],
  ['cities', 'Città'],
  ['places', 'Luoghi'],
  ['tones', 'Toni'],
  ['missions', 'Missioni'],
  ['generation-new', 'Genera AI'],
  ['generation-proposals', 'ReviewQueue AI'],
  ['system-prompt', 'Prompt Ombra'],
  ['sessions', 'Sessioni'],
  ['users', 'Utenti'],
];

const SCREEN_TITLES: Record<Screen, string> = {
  dashboard: 'Dashboard',
  cities: 'Gestione città',
  places: 'Gestione luoghi',
  tones: 'Toni narrativi',
  missions: 'Missioni',
  'system-prompt': 'System prompt',
  sessions: 'Sessioni',
  users: 'Utenti admin',
  'design-system': 'Design System',
  'generation-new': 'Generazione missioni',
  'generation-proposals': 'Proposte AI',
  'generation-proposal-detail': 'Dettaglio proposta'
};

const AUTH_DISABLED = import.meta.env.VITE_ADMIN_AUTH_DISABLED === 'true';

export default function App() {
  const [authenticated, setAuthenticated] = useState(AUTH_DISABLED || Boolean(getToken()));
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [generationCityId, setGenerationCityId] = useState('');
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [cities, setCities] = useState<Array<Record<string, any>>>([]);
  const loginForm = useForm<{ email: string; password: string }>({
    defaultValues: { email: 'admin@nightquest.it', password: '' }
  });

  const currentUser = authenticated ? decodeToken(getToken()) : null;

  async function loadDashboard() {
    const [dashboardData, citiesData] = await Promise.all([
      adminApi.dashboard(),
      adminApi.cities()
    ]);
    setDashboard(dashboardData);
    setCities(citiesData);
  }

  useEffect(() => {
    if (authenticated) {
      void loadDashboard();
    }
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg px-6">
        <form
          className="w-full max-w-md rounded-md border border-admin-border bg-admin-surface p-8"
          onSubmit={loginForm.handleSubmit(async (values) => {
            try {
              const response = await adminApi.login(values);
              setToken(response.token);
              setAuthenticated(true);
              toast.success('Accesso eseguito');
            } catch {
              toast.error('Credenziali non valide');
            }
          })}
        >
          <div className="mb-6">
            <div className="font-sans text-adminLabel uppercase tracking-[0.3em] text-admin-muted">
              NightQuest Admin
            </div>
            <h1 className="mt-3 font-sans text-adminTitle font-semibold text-admin-text">Accesso pannello</h1>
          </div>
          <div className="space-y-4">
            <Input {...loginForm.register('email')} placeholder="Email" />
            <Input {...loginForm.register('password')} type="password" placeholder="Password" />
            <Button className="w-full">Entra</Button>
          </div>
        </form>
      </div>
    );
  }

  const dashboardCards: Array<{ label: string; value: string | number }> = dashboard
    ? [
        { label: 'Sessioni attive', value: Number(dashboard.activeSessions ?? 0) },
        { label: 'Sessioni oggi', value: Number(dashboard.sessionsToday ?? 0) },
        { label: 'Missioni completate', value: Number(dashboard.missionsCompleted ?? 0) },
        { label: 'Tasso completamento', value: `${String(dashboard.completionRate ?? 0)}%` },
        { label: 'Città attive', value: Number(dashboard.activeCities ?? 0) }
      ]
    : [];

  const visibleNav = NAV.filter(([s]) => s !== 'users' || currentUser?.role === 'admin');

  return (
    <div className="min-h-screen bg-admin-bg text-admin-text">
      <div className="mx-auto hidden min-h-screen max-w-admin md:flex">
        <aside className="w-60 shrink-0 bg-admin-sidebar px-5 py-6 text-admin-sidebarText">
          <div className="mb-8">
            <div className="font-sans text-adminLabel uppercase tracking-[0.3em] text-admin-muted">NightQuest</div>
            <div className="mt-2 font-sans text-adminTitle font-semibold text-white">Admin</div>
          </div>
          <nav className="space-y-1">
            {visibleNav.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setScreen(value)}
                className={`w-full rounded-sm px-4 py-2.5 text-left font-sans text-adminBody transition ${
                  screen === value ? 'bg-white text-admin-text' : 'text-admin-sidebarText hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-8 border-t border-white/10 pt-4">
            {currentUser && (
              <div className="mb-3 font-sans text-adminLabel text-admin-muted">
                <div className="truncate">{currentUser.email}</div>
                <div className="mt-0.5 uppercase tracking-wider">[{currentUser.role}]</div>
              </div>
            )}
            <Button
              onClick={() => {
                clearToken();
                setAuthenticated(false);
              }}
              variant="ghost"
              className="justify-start px-0 text-admin-sidebarText hover:bg-transparent hover:text-white"
            >
              Esci
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-8 py-8">
          <div className="mb-8">
            <div className="font-sans text-adminLabel uppercase tracking-[0.25em] text-admin-muted">
              NightQuest / {screen}
            </div>
            <h1 className="mt-2 font-sans text-adminTitle font-semibold text-admin-text">
              {SCREEN_TITLES[screen]}
            </h1>
          </div>

          {screen === 'dashboard' && (
            <div className="space-y-6">
              {dashboard ? (
                <div className="grid gap-4 xl:grid-cols-5">
                  {dashboardCards.map(({ label, value }) => (
                    <Card key={label}>
                      <div className="font-sans text-adminBody text-admin-muted">{label}</div>
                      <div className="mt-2 font-sans text-adminTitle font-semibold text-admin-text">{value}</div>
                    </Card>
                  ))}
                </div>
              ) : null}
              {cities.length === 0 ? (
                <EmptyState
                  title="Inizia configurando la prima città"
                  description="Vai in Città per creare il primo contenuto."
                  actionLabel="Vai a Città"
                  onAction={() => setScreen('cities')}
                />
              ) : null}
            </div>
          )}

          {screen === 'cities' && (
            <CitiesPage
              onGenerateForCity={(cityId) => {
                setGenerationCityId(cityId);
                setScreen('generation-new');
              }}
              onOpenProposals={(cityId) => {
                setGenerationCityId(cityId);
                setScreen('generation-proposals');
              }}
            />
          )}
          {screen === 'places' && <PlacesPage />}
          {screen === 'tones' && <TonesPage />}
          {screen === 'missions' && <MissionsPage />}
          {screen === 'generation-new' && (
            <GenerationWizardPage
              initialCityId={generationCityId}
              onOpenProposals={() => setScreen('generation-proposals')}
            />
          )}
          {screen === 'generation-proposals' && (
            <GenerationProposalsPage
              initialCityId={generationCityId}
              onOpenProposal={(proposalId) => {
                setSelectedProposalId(proposalId);
                setScreen('generation-proposal-detail');
              }}
            />
          )}
          {screen === 'generation-proposal-detail' && selectedProposalId && (
            <GenerationProposalDetailPage
              proposalId={selectedProposalId}
              onBack={() => setScreen('generation-proposals')}
            />
          )}
          {screen === 'system-prompt' && <SystemPromptPage />}
          {screen === 'sessions' && <SessionsPage />}
          {screen === 'users' && currentUser?.role === 'admin' && <UsersPage />}
          {screen === 'design-system' && <DesignSystemPage />}
        </main>
      </div>

      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center md:hidden">
        <EmptyState
          title="Pannello ottimizzato per desktop"
          description="Apri il pannello admin da un viewport più ampio. L'app utente resta pensata per mobile."
        />
      </div>
    </div>
  );
}
