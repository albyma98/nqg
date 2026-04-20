import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { adminApi } from '../api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';

type AdminUser = { id: string; email: string; role: 'admin' | 'editor'; active: boolean; createdAt: string };
type CreateForm = { email: string; password: string; role: 'admin' | 'editor' };

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const form = useForm<CreateForm>({ defaultValues: { role: 'editor' } });

  async function load() {
    try {
      setUsers((await adminApi.users()) as AdminUser[]);
    } catch {
      // 403 if editor role — silently ignore
    }
  }

  useEffect(() => { void load(); }, []);

  async function onSubmit(values: CreateForm) {
    try {
      await adminApi.createUser(values);
      toast.success('Utente creato');
      setShowForm(false);
      form.reset({ email: '', password: '', role: 'editor' });
      await load();
    } catch {
      toast.error('Creazione non riuscita');
    }
  }

  async function toggleActive(user: AdminUser) {
    try {
      await adminApi.updateUser(user.id, { active: !user.active, role: user.role });
      await load();
    } catch {
      toast.error('Aggiornamento non riuscito');
    }
  }

  async function changeRole(user: AdminUser, role: 'admin' | 'editor') {
    try {
      await adminApi.updateUser(user.id, { active: user.active, role });
      await load();
    } catch {
      toast.error('Aggiornamento non riuscito');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-adminTitle font-semibold text-admin-text">Utenti admin</h2>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus size={14} className="mr-2" /> Nuovo utente
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-adminHeading font-semibold text-admin-text">Crea utente</h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Input {...form.register('email')} placeholder="Email" type="email" />
              <Input {...form.register('password')} placeholder="Password" type="password" />
              <Select {...form.register('role')}>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Crea</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Annulla
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-6">
        {users.length === 0 ? (
          <div className="font-sans text-adminBody text-admin-muted">
            Nessun utente trovato. Solo gli admin possono accedere a questa sezione.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Email</TH>
                  <TH>Ruolo</TH>
                  <TH>Stato</TH>
                  <TH>Creato</TH>
                  <TH>Azioni</TH>
                </tr>
              </THead>
              <TBody>
                {users.map((user) => (
                  <TR key={user.id}>
                    <TD>{user.email}</TD>
                    <TD>
                      <Select
                        value={user.role}
                        onChange={(e) => void changeRole(user, e.target.value as 'admin' | 'editor')}
                        className="w-28 py-1.5"
                      >
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </TD>
                    <TD>
                      <Badge tone={user.active ? 'success' : 'muted'}>
                        {user.active ? 'Attivo' : 'Disabilitato'}
                      </Badge>
                    </TD>
                    <TD>{new Date(user.createdAt).toLocaleDateString('it-IT')}</TD>
                    <TD>
                      <Button
                        variant={user.active ? 'outline' : 'primary'}
                        onClick={() => void toggleActive(user)}
                      >
                        {user.active ? 'Disabilita' : 'Abilita'}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
