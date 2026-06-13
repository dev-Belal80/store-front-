export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="w-full sm:w-auto shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}