'use client';

// AdminLTE/TheHive4 badge components ported from frontend/app/views/directives/
// severity.html, tlp.html, tag-item.html, tag-list.html, task-flags.html,
// observable-flags.html. Visual classes follow legacy Bootstrap labels.

import { ReactNode } from 'react';

const SEVERITY_LABELS: Record<number, { letter: string; klass: string; full: string }> = {
  1: { letter: 'L', klass: 'label-info', full: 'Low' },
  2: { letter: 'M', klass: 'label-warning', full: 'Medium' },
  3: { letter: 'H', klass: 'label-danger', full: 'High' },
  4: { letter: 'C', klass: 'label-critical', full: 'Critical' },
};

/** severity.html: active=true renders clickable picker, otherwise static label */
export function Severity({
  value, active, onUpdate,
}: { value: number; active?: boolean; onUpdate?: (newValue: number) => void }) {
  const safe = value && SEVERITY_LABELS[value] ? value : 2;
  if (active) {
    return (
      <span className="severity-picker">
        {[1, 2, 3, 4].map((level) => {
          const meta = SEVERITY_LABELS[level];
          const klass = level === safe ? meta.klass : 'label-default';
          return (
            <span
              key={level}
              className={`clickable label ${klass}`}
              style={{ marginRight: 2, cursor: 'pointer' }}
              onClick={() => onUpdate?.(level)}
            >
              {meta.letter}
            </span>
          );
        })}
      </span>
    );
  }
  const meta = SEVERITY_LABELS[safe] ?? { letter: '?', klass: 'label-primary', full: 'Unknown' };
  return <span className={`label ${meta.klass}`} title={meta.full}>{meta.letter}</span>;
}

const TLP_LABELS = ['WHITE', 'GREEN', 'AMBER', 'RED'] as const;
const TLP_KLASSES = ['label-info', 'label-success', 'label-warning', 'label-danger'] as const;

/** tlp.html: format=active|static|icon. namespace defaults to 'TLP', also used for PAP */
export function Tlp({
  value, format = 'static', namespace = 'TLP', onUpdate,
}: { value: number; format?: 'active' | 'static' | 'icon'; namespace?: string; onUpdate?: (newValue: number) => void }) {
  const safe = Math.max(0, Math.min(3, value ?? 0));
  if (format === 'active') {
    return (
      <span className="tlp-picker">
        {TLP_LABELS.map((label, level) => {
          const klass = level === safe ? TLP_KLASSES[level] : 'label-default';
          return (
            <span
              key={label}
              className={`label ${klass}`}
              style={{ marginRight: 2, cursor: 'pointer' }}
              onClick={() => onUpdate?.(level)}
            >
              {label}
            </span>
          );
        })}
      </span>
    );
  }
  if (format === 'icon') {
    const colours = ['#aaa', '#28a745', '#ffc107', '#dc3545'];
    return (
      <span style={{ color: colours[safe], display: 'inline-block', marginRight: 4 }} title={`${namespace}:${TLP_LABELS[safe]}`}>
        <i className={safe === 0 ? 'fa fa-circle-o' : 'fa fa-circle'} />
      </span>
    );
  }
  return <span className={`label ${TLP_KLASSES[safe]}`}>{namespace}:{TLP_LABELS[safe]}</span>;
}

/** Convenience PAP component on top of Tlp */
export function Pap(props: { value: number; format?: 'active' | 'static' | 'icon'; onUpdate?: (newValue: number) => void }) {
  return <Tlp {...props} namespace="PAP" />;
}

/** tag-item.html: a single tag pill */
export function TagItem({
  value, color, onClick,
}: { value: string; color?: string; onClick?: () => void }) {
  return (
    <span
      className="label label-primary tag-item mr-xxxs mb-xxxs"
      style={{ backgroundColor: color || undefined, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {value}
    </span>
  );
}

/** tag-list.html: list of tags with default 'None' fallback */
export function TagList({
  data, onClick,
}: { data: string[] | undefined | null; onClick?: (tag: string) => void }) {
  if (!data || data.length === 0) {
    return (
      <span className="case-tags flexwrap mt-xxs">
        <span className="mr-xxxs text-muted"><i className="fa fa-tags" /></span>
        <strong className="text-muted mr-xxxs">None</strong>
      </span>
    );
  }
  return (
    <span className="case-tags flexwrap mt-xxs">
      <span className="mr-xxxs text-muted"><i className="fa fa-tags" /></span>
      {data.map((tag) => <TagItem key={tag} value={tag} onClick={onClick ? () => onClick(tag) : undefined} />)}
    </span>
  );
}

/** task-flags.html: status icon for tasks */
export function TaskFlags({
  task, inline = true, onFilter,
}: { task: { status: string; flag?: boolean }; inline?: boolean; onFilter?: (field: string, value: unknown) => void }) {
  const wrapper = inline ? 'span' : 'div';
  const Wrapper = wrapper as 'span';
  return (
    <Wrapper className="task-flags">
      {task.status === 'Completed' && (
        <i className="text-success glyphicon glyphicon-ok" title="Completed" onClick={() => onFilter?.('status', 'Completed')} />
      )}
      {task.status === 'InProgress' && (
        <i
          className={`glyphicon ${task.flag ? 'text-yellow glyphicon-flag' : 'text-primary glyphicon-play'}`}
          title="In Progress"
          onClick={() => onFilter?.('status', 'InProgress')}
        />
      )}
      {task.status === 'Waiting' && (
        <i className={`glyphicon ${task.flag ? 'text-yellow glyphicon-flag' : 'glyphicon-time'}`} title="Waiting" onClick={() => onFilter?.('status', 'Waiting')} />
      )}
      {task.status === 'Cancel' && (
        <i className="text-muted glyphicon glyphicon-ban-circle" title="Cancelled" onClick={() => onFilter?.('status', 'Cancel')} />
      )}
    </Wrapper>
  );
}

/** observable-flags.html: ioc/sighted/ignoreSimilarity icon strip */
export function ObservableFlags({
  observable,
}: { observable: { ioc?: boolean; sighted?: boolean; ignore_similarity?: boolean } }) {
  return (
    <span className="observable-flags">
      {observable.ioc && <i className="fa fa-bullseye text-danger" title="Indicator of Compromise" style={{ marginRight: 4 }} />}
      {observable.sighted && <i className="fa fa-eye text-warning" title="Sighted" style={{ marginRight: 4 }} />}
      {observable.ignore_similarity && <i className="fa fa-eye-slash text-muted" title="Ignore similarity" style={{ marginRight: 4 }} />}
    </span>
  );
}

/** Empty message helper matching legacy `.empty-message` */
export function EmptyMessage({ children = 'No records' }: { children?: ReactNode }) {
  return <div className="empty-message">{children}</div>;
}

/** Datalist header showing total items, ported from datalist-header.component.html */
export function DatalistHeader({
  title, total, displayed,
}: { title: string; total: number; displayed?: number }) {
  return (
    <span>
      {title}{' '}
      <small className="text-muted">
        ({typeof displayed === 'number' ? `${displayed} of ` : ''}{total})
      </small>
    </span>
  );
}
