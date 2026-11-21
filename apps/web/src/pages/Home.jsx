import { useNavigate } from 'react-router-dom';
import { UserPlus, PhoneCall, AlarmClock, CheckCheck, ListTodo, CalendarClock, Hourglass, Flag } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useFetch, Loading, Stat, Card, PageHead, Badge, NatureBadge, Empty, DataTable } from '../ui/kit.jsx';
import { dateTime, money } from '../api.js';
import { BarChart } from '../ui/charts.jsx';

export default function Home() {
  const { user } = useAuth(); const nav = useNavigate();
  const d = useFetch('/home');
  if (!d.data) return <div className="page"><Loading d={d} /></div>;
  const { leads, tasks, schedule, taskList, itemSummary } = d.data;
  const h = new Date().getHours();
  return (
    <div className="page">
      <PageHead title={`${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${user.name.split(' ')[0]}`} sub="Here is where your day stands." />
      <h4 className="muted small mb" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>My leads</h4>
      <div className="grid g4 mb">
        <Stat label="New enquiries" value={leads.new} icon={UserPlus} tone="info" onClick={() => nav('/leads?tab=new')} />
        <Stat label="Follow-ups today" value={leads.followups} icon={PhoneCall} onClick={() => nav('/followups')} />
        <Stat label="Delayed" value={leads.delayed} icon={AlarmClock} tone="bad" onClick={() => nav('/leads?missed=1')} />
        <Stat label="Done today" value={leads.completed} icon={CheckCheck} tone="good" />
      </div>
      <h4 className="muted small mb" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>My tasks</h4>
      <div className="grid g4 mb">
        <Stat label="Pending" value={tasks.pending} icon={Hourglass} tone="warn" onClick={() => nav('/my-tasks')} />
        <Stat label="Due today" value={tasks.today} icon={CalendarClock} onClick={() => nav('/my-tasks')} />
        <Stat label="Delayed" value={tasks.delayed} icon={Flag} tone="bad" onClick={() => nav('/my-tasks')} />
        <Stat label="Completed today" value={tasks.completed} icon={ListTodo} tone="good" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: '3fr 2fr' }}>
        <Card title="Follow-up schedule" actions={<button className="btn sm" onClick={() => nav('/followups')}>Open agenda</button>} flush>
          <DataTable rows={schedule} onRow={(r) => nav(`/leads/${r.id}`)} empty={<Empty title="No follow-ups pending" sub="Enjoy the calm." />} columns={[
            { key: 'number', label: '#', render: (r) => `#${r.number}` }, { key: 'customer', label: 'Customer', render: (r) => <><b>{r.customer}</b><div className="small muted">{r.phone}</div></> },
            { key: 'items', label: 'Enquiry for', render: (r) => <span className="small">{r.items || '—'}</span> }, { key: 'status', label: 'Status' },
            { key: 'next_followup', label: 'Due', render: (r) => <Badge kind={r.next_followup < new Date().toISOString().slice(0, 10) ? 'bad' : 'brand'}>{dateTime(r.next_followup)}</Badge> }]} />
        </Card>
        <div className="col">
          <Card title="Today’s tasks" actions={<button className="btn sm" onClick={() => nav('/my-tasks')}>Task board</button>}>
            {taskList.length ? taskList.map((t) => <div className="list-item" key={t.id}><Badge kind="info">{t.type}</Badge><div className="grow">{t.title}</div><span className="small muted">{t.scheduled_at?.slice(11)}</span></div>) : <Empty title="No tasks today" />}
          </Card>
          {itemSummary && <Card title="Open enquiries by item"><BarChart horizontal data={itemSummary.map((x) => ({ name: x.item, value: x.n }))} fmt={(n) => n} /></Card>}
        </div>
      </div>
    </div>
  );
}
