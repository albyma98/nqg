import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/Table';

export function DesignSystemPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="font-sans text-adminLabel uppercase tracking-[0.25em] text-admin-muted">Living Styleguide</div>
        <h1 className="font-sans text-adminTitle font-semibold text-admin-text">Design system admin</h1>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-sans text-adminHeading font-semibold text-admin-text">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-sans text-adminHeading font-semibold text-admin-text">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Attiva</Badge>
            <Badge tone="success">Approvata</Badge>
            <Badge tone="danger">Errore</Badge>
            <Badge tone="muted">Bozza</Badge>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-sans text-adminHeading font-semibold text-admin-text">Form</h2>
          <Input placeholder="Titolo missione" />
          <Select defaultValue="gallipoli">
            <option value="gallipoli">Gallipoli</option>
            <option value="lecce">Lecce</option>
          </Select>
          <Textarea className="h-32" placeholder="Descrizione o brief" />
        </Card>

        <EmptyState title="Nessun elemento. Inizia creandone uno." description="Questo stato mostra il vuoto standard del pannello admin." actionLabel="Crea elemento" />

        <Card className="xl:col-span-2">
          <h2 className="mb-4 font-sans text-adminHeading font-semibold text-admin-text">Tabella</h2>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Nome</TH>
                  <TH>Stato</TH>
                  <TH>Ultimo aggiornamento</TH>
                </tr>
              </THead>
              <TBody>
                <TR>
                  <TD>Il passaggio</TD>
                  <TD><Badge tone="success">Attiva</Badge></TD>
                  <TD>19/04/2026</TD>
                </TR>
                <TR>
                  <TD>Dove non guarderesti</TD>
                  <TD><Badge tone="muted">Bozza</Badge></TD>
                  <TD>18/04/2026</TD>
                </TR>
              </TBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
