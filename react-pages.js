const { useEffect, useState } = React;

const money = (value, tipo = '') => `${Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${tipo === 'Aluguel' ? '/mês' : ''}`;

function UserMenu({ usuario, onLogout, active = false }) {
  const [open, setOpen] = useState(false);
  if (!usuario) return <a className={`react-action ${active ? 'active' : ''}`} href="login.html">Área do usuário</a>;
  const iniciais = usuario.nome.trim().split(/\s+/).slice(0, 2).map((nome) => nome[0]).join('').toUpperCase();
  return <div className="react-user-menu"><button className={`react-user-link ${active ? 'active' : ''}`} onClick={() => setOpen(!open)}><span className="react-avatar">{iniciais}</span><span>Olá, {usuario.nome.trim().split(/\s+/)[0]}</span><span className="user-chevron">⌄</span></button>{open && <div className="user-dropdown"><a href="perfil.html">Meu perfil</a><a href="cadastro.html?modo=imovel">Cadastrar imóvel</a><button onClick={onLogout}>Sair</button></div>}</div>;
}

function Layout({ children, eyebrow = 'Runge Haus' }) {
  const [usuario, setUsuario] = useState(null);
  useEffect(() => {
    fetch('/api/minha-conta').then((res) => res.ok ? res.json() : null).then((data) => setUsuario(data?.usuario || null)).catch(() => setUsuario(null));
    const atualizarSessao = (event) => setUsuario(event.detail?.usuario || null);
    window.addEventListener('runge:session', atualizarSessao);
    return () => window.removeEventListener('runge:session', atualizarSessao);
  }, []);
  const iniciais = usuario ? usuario.nome.trim().split(/\s+/).slice(0, 2).map((nome) => nome[0]).join('').toUpperCase() : '';
  const sair = async () => { await fetch('/api/logout', { method: 'POST' }); setUsuario(null); window.dispatchEvent(new CustomEvent('runge:session', { detail: { usuario: null } })); };
  const moduloUsuario = path.endsWith('login.html') || path.endsWith('perfil.html');
  const moduloImoveis = path.endsWith('imoveis.html') || path.endsWith('imovel.html');
  return <div className="react-shell"><header className="react-header"><a className="react-brand" href="index.html"><img src="assets/runge-imobiliaria.png" alt="Runge Imobiliária" /></a><a className="home-button" href="index.html">Página inicial</a><nav className="react-nav"><a className={moduloImoveis ? 'active' : ''} href="imoveis.html">Imóveis</a><UserMenu usuario={usuario} onLogout={sair} active={moduloUsuario}/></nav></header><main className="react-page"><p className="eyebrow">{eyebrow}</p>{children}</main></div>;
}

function ProfilePage() {
  const [data, setData] = useState(null); const [form, setForm] = useState({}); const [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/minha-conta').then((r) => r.ok ? r.json() : null).then((result) => { if (result) { setData(result.usuario); setForm(result.usuario); } else location.href = 'login.html'; }); }, []);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  async function save(event) { event.preventDefault(); setMessage('Salvando…'); const response = await fetch('/api/perfil', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); const result = await response.json(); if (!response.ok) return setMessage(result.error || 'Não foi possível salvar.'); setData(result.usuario); setForm(result.usuario); setMessage('Perfil atualizado com sucesso.'); window.dispatchEvent(new CustomEvent('runge:session', { detail: result })); }
  if (!data) return <Layout eyebrow="Meu perfil"><p>Carregando perfil…</p></Layout>;
  return <Layout eyebrow="Meu perfil"><h1>Seus dados.</h1><p className="react-lead">Atualize as informações usadas no seu cadastro.</p><form className="react-profile-form" onSubmit={save}><div className="react-profile-grid">{[['nome','Nome'],['telefone','Telefone'],['cep','CEP'],['rua','Rua'],['numero','Número'],['bairro','Bairro'],['cidade','Cidade'],['estado','Estado']].map(([name,label]) => <label key={name}>{label}<input name={name} value={form[name] || ''} onChange={change} required/></label>)}</div><p className="react-lead">E-mail de acesso: <strong>{data.email}</strong></p>{message && <p className="react-success-message">{message}</p>}<button className="react-button">Salvar alterações</button></form></Layout>;
}

function PropertyCardBase({ item }) { return <a className="react-property-card" href={`imovel.html?id=${item.id}`}><span>{item.tipo} · {item.categoria}</span><h2>{item.titulo}</h2><p>{item.endereco}</p><strong>{money(item.preco, item.tipo)}</strong><b>Ver detalhes →</b></a>; }

function PropertyCard({ item }) { return <a className="react-property-card" href={`imovel.html?id=${item.id}`}>{item.fotos?.[0] && <img className="property-card-image" src={item.fotos[0].url} alt={item.fotos[0].nome || item.titulo} />}<span>{item.tipo} · {item.categoria}</span><h2>{item.titulo}</h2><p>{item.endereco}</p><strong>{money(item.preco, item.tipo)}</strong><b>Ver detalhes →</b></a>; }

function ListPage() {
  const [items, setItems] = useState(null);
  useEffect(() => { fetch('/api/imoveis').then(r => r.json()).then(setItems).catch(() => setItems([])); }, []);
  return <Layout eyebrow="Oportunidades"><h1>Imóveis cadastrados.</h1><p className="react-lead">Encontre uma propriedade e veja seus detalhes.</p><div className="react-property-grid">{items === null ? <p>Carregando imóveis…</p> : items.length ? items.map(item => <PropertyCard key={item.id} item={item}/>) : <p>Nenhum imóvel cadastrado no momento.</p>}</div></Layout>;
}

function LoginPage() {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [data, setData] = useState(null); const [message, setMessage] = useState('');
  const load = () => fetch('/api/minha-conta').then(r => r.ok ? r.json() : null).then(setData);
  useEffect(load, []);
  async function submit(event) { event.preventDefault(); setMessage('Entrando…'); const response = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, senha}) }); const result = await response.json(); if (!response.ok) return setMessage(result.error || 'Não foi possível entrar.'); setData(result); window.dispatchEvent(new CustomEvent('runge:session', { detail: result })); setMessage(''); }
  async function logout() { await fetch('/api/logout', { method:'POST' }); setData(null); window.dispatchEvent(new CustomEvent('runge:session', { detail: { usuario: null } })); }
  if (data) return <Layout eyebrow="Minha conta"><div className="react-account-head"><div><h1>Olá, {data.usuario.nome}.</h1><p className="react-lead">Sessão ativa · expira após 10 minutos sem atividade</p></div><div><a className="react-button" href="cadastro.html?modo=imovel">+ Cadastrar imóvel</a><button className="react-button secondary" onClick={logout}>Sair</button></div></div><div className="react-account-summary"><strong>{data.imoveis.length}</strong><span>imóveis cadastrados</span></div><div className="react-property-grid">{data.imoveis.length ? data.imoveis.map(item => <PropertyCard key={item.id} item={item}/>) : <p>Você ainda não cadastrou imóveis.</p>}</div></Layout>;
  return <Layout eyebrow="Acesso do usuário"><h1>Entre na sua conta.</h1><p className="react-lead">Acesse os imóveis cadastrados por você.</p><form className="react-form" onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} required/></label>{message && <p className="react-error">{message}</p>}<button className="react-button" type="submit">Entrar</button></form><p className="react-lead">Ainda não tem cadastro? <a href="cadastro.html">Cadastre um imóvel</a>.</p></Layout>;
}

function DetailPageLegacy() {
  const [item, setItem] = useState(null); const [contact, setContact] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { const id = new URLSearchParams(location.search).get('id'); fetch('/api/imoveis').then(r=>r.json()).then(items=>setItem(items.find(x=>x.id===Number(id)) || false)); }, []);
  async function send(event) { event.preventDefault(); const response = await fetch(`/api/imoveis/${item.id}/contatos`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); const result = await response.json(); setMessage(result.message || result.error); if(response.ok) event.currentTarget.reset(); }
  if (item === null) return <Layout><p>Carregando imóvel…</p></Layout>;
  if (!item) return <Layout><h1>Imóvel não encontrado.</h1><a href="imoveis.html">Voltar para a lista</a></Layout>;
  const donoDoImovel = account?.usuario?.id === item.usuario_id;
  return <Layout eyebrow={`${item.tipo} · ${item.categoria}`}><h1>{item.titulo}</h1><p className="react-price">{money(item.preco, item.tipo)}</p><p className="react-lead">⌖ {item.endereco}</p><p className="react-description">{item.descricao}</p><button className="react-button" onClick={()=>setContact(true)}>Entrar em contato</button>{contact && <div className="react-modal"><div className="react-modal-card"><button className="modal-close" onClick={()=>setContact(false)}>×</button><h2>Entrar em contato</h2><form className="react-form" onSubmit={send}><label>Nome<input name="nome" required/></label><label>Telefone<input name="telefone" required/></label><label>E-mail<input name="email" type="email" required/></label>{message&&<p>{message}</p>}<button className="react-button">Enviar contato</button></form></div></div>}</Layout>;
}

function SuccessPage() { const [seconds, setSeconds] = useState(5); useEffect(()=>{const timer=setInterval(()=>setSeconds(s=>s-1),1000); const redirect=setTimeout(()=>location.href='index.html',5000); return ()=>{clearInterval(timer);clearTimeout(redirect);};},[]); const nome=new URLSearchParams(location.search).get('nome'); return <Layout eyebrow="Tudo certo"><div className="react-success"><span>✓</span><h1>Cadastro concluído.</h1><p>{nome ? `${nome}, o imóvel foi cadastrado com sucesso.` : 'O imóvel foi cadastrado com sucesso.'}</p><div><a className="react-button" href="cadastro.html?modo=imovel">Cadastrar outro imóvel</a><a className="react-button secondary" href="index.html">Página inicial</a></div><small>Redirecionando em {Math.max(seconds,0)} segundos.</small></div></Layout>; }

function AccountPropertyCard({ item }) { return <div className="react-property-card">{item.fotos?.[0] && <img className="property-card-image" src={item.fotos[0].url} alt={item.fotos[0].nome || item.titulo} />}<a className="property-card-link" href={`imovel.html?id=${item.id}`}><span>{item.tipo} · {item.categoria}</span><h2>{item.titulo}</h2><p>{item.endereco}</p><strong>{money(item.preco, item.tipo)}</strong></a><a className="property-edit-link" href={`cadastro.html?modo=editar&id=${item.id}`}>Editar imóvel</a></div>; }
function LoginPageWithEdit() { const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [data, setData] = useState(null); const [message, setMessage] = useState(''); const load = () => fetch('/api/minha-conta').then(r => r.ok ? r.json() : null).then(setData); useEffect(load, []); async function submit(event) { event.preventDefault(); setMessage('Entrando…'); const response = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, senha}) }); const result = await response.json(); if (!response.ok) return setMessage(result.error || 'Não foi possível entrar.'); setData(result); window.dispatchEvent(new CustomEvent('runge:session', { detail: result })); setMessage(''); } async function logout() { await fetch('/api/logout', { method:'POST' }); setData(null); window.dispatchEvent(new CustomEvent('runge:session', { detail: { usuario: null } })); } if (data) return <Layout eyebrow="Minha conta"><div className="react-account-head"><div><h1>Olá, {data.usuario.nome}.</h1><p className="react-lead">Sessão ativa · expira após 10 minutos sem atividade</p></div><div><a className="react-button" href="cadastro.html?modo=imovel">+ Cadastrar imóvel</a><button className="react-button secondary" onClick={logout}>Sair</button></div></div><div className="react-account-summary"><strong>{data.imoveis.length}</strong><span>imóveis cadastrados</span></div><div className="react-property-grid">{data.imoveis.length ? data.imoveis.map(item => <AccountPropertyCard key={item.id} item={item}/>) : <p>Você ainda não cadastrou imóveis.</p>}</div></Layout>; return <Layout eyebrow="Acesso do usuário"><h1>Entre na sua conta.</h1><p className="react-lead">Acesse os imóveis cadastrados por você.</p><form className="react-form" onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} required/></label>{message && <p className="react-error">{message}</p>}<button className="react-button" type="submit">Entrar</button></form><p className="react-lead">Ainda não tem cadastro? <a href="cadastro.html">Cadastre um imóvel</a>.</p></Layout>; }

function DetailPageOwnerEdit() {
  const [item, setItem] = useState(null); const [account, setAccount] = useState(null); const [contact, setContact] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { const id = new URLSearchParams(location.search).get('id'); fetch('/api/imoveis').then(r => r.json()).then(items => setItem(items.find(x => x.id === Number(id)) || false)); fetch('/api/minha-conta').then(r => r.ok ? r.json() : null).then(setAccount).catch(() => setAccount(null)); }, []);
  async function send(event) { event.preventDefault(); const response = await fetch(`/api/imoveis/${item.id}/contatos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); const result = await response.json(); setMessage(result.message || result.error); if (response.ok) event.currentTarget.reset(); }
  if (item === null) return <Layout><p>Carregando imovel...</p></Layout>;
  if (!item) return <Layout><h1>Imovel nao encontrado.</h1><a href="imoveis.html">Voltar para a lista</a></Layout>;
  const isOwner = account?.usuario?.id === item.usuario_id;
  return <Layout eyebrow={`${item.tipo} · ${item.categoria}`}><h1>{item.titulo}</h1>{item.fotos?.length > 0 && <div className="property-gallery">{item.fotos.map(foto => <img key={foto.id} src={foto.url} alt={foto.nome || item.titulo} />)}</div>}<p className="react-price">{money(item.preco, item.tipo)}</p><p className="react-lead">⌖ {item.endereco}</p><p className="react-description">{item.descricao}</p><div className="property-detail-actions"><button className="react-button" onClick={() => setContact(true)}>Entrar em contato</button>{isOwner && <a className="react-button secondary" href={`cadastro.html?modo=editar&id=${item.id}`}>Editar imóvel</a>}</div>{contact && <div className="react-modal"><div className="react-modal-card"><button className="modal-close" onClick={() => setContact(false)}>×</button><h2>Entrar em contato</h2><form className="react-form" onSubmit={send}><label>Nome<input name="nome" required /></label><label>Telefone<input name="telefone" required /></label><label>E-mail<input name="email" type="email" required /></label>{message && <p>{message}</p>}<button className="react-button">Enviar contato</button></form></div></div>}</Layout>;
}

const path = location.pathname;
const Page = path.endsWith('login.html') ? LoginPageWithEdit : path.endsWith('imovel.html') ? DetailPageOwnerEdit : path.endsWith('sucesso.html') ? SuccessPage : path.endsWith('perfil.html') ? ProfilePage : ListPage;
ReactDOM.createRoot(document.getElementById('root')).render(<Page/>);

function DetailPageWithPhotos() {
  const [item, setItem] = useState(null); const [contact, setContact] = useState(false); const [message, setMessage] = useState('');
  const [account, setAccount] = useState(null);
  useEffect(() => { fetch('/api/minha-conta').then(r => r.ok ? r.json() : null).then(setAccount).catch(() => setAccount(null)); }, []);
  useEffect(() => { const id = new URLSearchParams(location.search).get('id'); fetch('/api/imoveis').then(r => r.json()).then(items => setItem(items.find(x => x.id === Number(id)) || false)); }, []);
  async function send(event) { event.preventDefault(); const response = await fetch(`/api/imoveis/${item.id}/contatos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); const result = await response.json(); setMessage(result.message || result.error); if (response.ok) event.currentTarget.reset(); }
  if (item === null) return <Layout><p>Carregando imóvel…</p></Layout>;
  if (!item) return <Layout><h1>Imóvel não encontrado.</h1><a href="imoveis.html">Voltar para a lista</a></Layout>;
  return <Layout eyebrow={`${item.tipo} · ${item.categoria}`}><h1>{item.titulo}</h1>{item.fotos?.length > 0 && <div className="property-gallery">{item.fotos.map((foto) => <img key={foto.id} src={foto.url} alt={foto.nome || item.titulo} />)}</div>}<p className="react-price">{money(item.preco, item.tipo)}</p><p className="react-lead">⌖ {item.endereco}</p><p className="react-description">{item.descricao}</p><button className="react-button" onClick={() => setContact(true)}>Entrar em contato</button>{contact && <div className="react-modal"><div className="react-modal-card"><button className="modal-close" onClick={() => setContact(false)}>×</button><h2>Entrar em contato</h2><form className="react-form" onSubmit={send}><label>Nome<input name="nome" required /></label><label>Telefone<input name="telefone" required /></label><label>E-mail<input name="email" type="email" required /></label>{message && <p>{message}</p>}<button className="react-button">Enviar contato</button></form></div></div>}</Layout>;
}
