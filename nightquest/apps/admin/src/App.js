import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { clearToken, adminApi, getToken, setToken, decodeToken } from './api';
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
const NAV = [
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
const SCREEN_TITLES = {
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
    const [screen, setScreen] = useState('dashboard');
    const [generationCityId, setGenerationCityId] = useState('');
    const [selectedProposalId, setSelectedProposalId] = useState('');
    const [dashboard, setDashboard] = useState(null);
    const [cities, setCities] = useState([]);
    const loginForm = useForm({
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
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-admin-bg px-6", children: _jsxs("form", { className: "w-full max-w-md rounded-md border border-admin-border bg-admin-surface p-8", onSubmit: loginForm.handleSubmit(async (values) => {
                    try {
                        const response = await adminApi.login(values);
                        setToken(response.token);
                        setAuthenticated(true);
                        toast.success('Accesso eseguito');
                    }
                    catch {
                        toast.error('Credenziali non valide');
                    }
                }), children: [_jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "font-sans text-adminLabel uppercase tracking-[0.3em] text-admin-muted", children: "NightQuest Admin" }), _jsx("h1", { className: "mt-3 font-sans text-adminTitle font-semibold text-admin-text", children: "Accesso pannello" })] }), _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { ...loginForm.register('email'), placeholder: "Email" }), _jsx(Input, { ...loginForm.register('password'), type: "password", placeholder: "Password" }), _jsx(Button, { className: "w-full", children: "Entra" })] })] }) }));
    }
    const dashboardCards = dashboard
        ? [
            { label: 'Sessioni attive', value: Number(dashboard.activeSessions ?? 0) },
            { label: 'Sessioni oggi', value: Number(dashboard.sessionsToday ?? 0) },
            { label: 'Missioni completate', value: Number(dashboard.missionsCompleted ?? 0) },
            { label: 'Tasso completamento', value: `${String(dashboard.completionRate ?? 0)}%` },
            { label: 'Città attive', value: Number(dashboard.activeCities ?? 0) }
        ]
        : [];
    const visibleNav = NAV.filter(([s]) => s !== 'users' || currentUser?.role === 'admin');
    return (_jsxs("div", { className: "min-h-screen bg-admin-bg text-admin-text", children: [_jsxs("div", { className: "mx-auto hidden min-h-screen max-w-admin md:flex", children: [_jsxs("aside", { className: "w-60 shrink-0 bg-admin-sidebar px-5 py-6 text-admin-sidebarText", children: [_jsxs("div", { className: "mb-8", children: [_jsx("div", { className: "font-sans text-adminLabel uppercase tracking-[0.3em] text-admin-muted", children: "NightQuest" }), _jsx("div", { className: "mt-2 font-sans text-adminTitle font-semibold text-white", children: "Admin" })] }), _jsx("nav", { className: "space-y-1", children: visibleNav.map(([value, label]) => (_jsx("button", { onClick: () => setScreen(value), className: `w-full rounded-sm px-4 py-2.5 text-left font-sans text-adminBody transition ${screen === value ? 'bg-white text-admin-text' : 'text-admin-sidebarText hover:bg-white/10'}`, children: label }, value))) }), _jsxs("div", { className: "mt-8 border-t border-white/10 pt-4", children: [currentUser && (_jsxs("div", { className: "mb-3 font-sans text-adminLabel text-admin-muted", children: [_jsx("div", { className: "truncate", children: currentUser.email }), _jsxs("div", { className: "mt-0.5 uppercase tracking-wider", children: ["[", currentUser.role, "]"] })] })), _jsx(Button, { onClick: () => {
                                            clearToken();
                                            setAuthenticated(false);
                                        }, variant: "ghost", className: "justify-start px-0 text-admin-sidebarText hover:bg-transparent hover:text-white", children: "Esci" })] })] }), _jsxs("main", { className: "min-w-0 flex-1 px-8 py-8", children: [_jsxs("div", { className: "mb-8", children: [_jsxs("div", { className: "font-sans text-adminLabel uppercase tracking-[0.25em] text-admin-muted", children: ["NightQuest / ", screen] }), _jsx("h1", { className: "mt-2 font-sans text-adminTitle font-semibold text-admin-text", children: SCREEN_TITLES[screen] })] }), screen === 'dashboard' && (_jsxs("div", { className: "space-y-6", children: [dashboard ? (_jsx("div", { className: "grid gap-4 xl:grid-cols-5", children: dashboardCards.map(({ label, value }) => (_jsxs(Card, { children: [_jsx("div", { className: "font-sans text-adminBody text-admin-muted", children: label }), _jsx("div", { className: "mt-2 font-sans text-adminTitle font-semibold text-admin-text", children: value })] }, label))) })) : null, cities.length === 0 ? (_jsx(EmptyState, { title: "Inizia configurando la prima citt\u00E0", description: "Vai in Citt\u00E0 per creare il primo contenuto.", actionLabel: "Vai a Citt\u00E0", onAction: () => setScreen('cities') })) : null] })), screen === 'cities' && (_jsx(CitiesPage, { onGenerateForCity: (cityId) => {
                                    setGenerationCityId(cityId);
                                    setScreen('generation-new');
                                }, onOpenProposals: (cityId) => {
                                    setGenerationCityId(cityId);
                                    setScreen('generation-proposals');
                                } })), screen === 'places' && _jsx(PlacesPage, {}), screen === 'tones' && _jsx(TonesPage, {}), screen === 'missions' && _jsx(MissionsPage, {}), screen === 'generation-new' && (_jsx(GenerationWizardPage, { initialCityId: generationCityId, onOpenProposals: () => setScreen('generation-proposals') })), screen === 'generation-proposals' && (_jsx(GenerationProposalsPage, { initialCityId: generationCityId, onOpenProposal: (proposalId) => {
                                    setSelectedProposalId(proposalId);
                                    setScreen('generation-proposal-detail');
                                } })), screen === 'generation-proposal-detail' && selectedProposalId && (_jsx(GenerationProposalDetailPage, { proposalId: selectedProposalId, onBack: () => setScreen('generation-proposals') })), screen === 'system-prompt' && _jsx(SystemPromptPage, {}), screen === 'sessions' && _jsx(SessionsPage, {}), screen === 'users' && currentUser?.role === 'admin' && _jsx(UsersPage, {}), screen === 'design-system' && _jsx(DesignSystemPage, {})] })] }), _jsx("div", { className: "flex min-h-screen items-center justify-center px-6 py-10 text-center md:hidden", children: _jsx(EmptyState, { title: "Pannello ottimizzato per desktop", description: "Apri il pannello admin da un viewport pi\u00F9 ampio. L'app utente resta pensata per mobile." }) })] }));
}
