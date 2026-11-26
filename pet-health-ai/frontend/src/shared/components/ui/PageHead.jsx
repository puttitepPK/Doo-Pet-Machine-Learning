export const PageHead = ({ icon: Icon, title, sub }) => (
  <div className="page-head"><span className="badge"><Icon size={22} /></span><div><h1>{title}</h1><p>{sub}</p></div></div>
);

