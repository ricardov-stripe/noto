export default function App() {
  return <div style={{ display: 'flex', height: '100vh' }}>
    <aside style={{ width: 200, borderRight: '1px solid #ddd', padding: 16 }}>Sidebar</aside>
    <main style={{ flex: 1, padding: 16 }}>Editor</main>
    <aside style={{ width: 280, borderLeft: '1px solid #ddd', padding: 16 }}>Tasks</aside>
  </div>;
}
