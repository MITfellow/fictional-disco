import {
  Divider,
  Dropdown,
  Field,
  Input,
  Menu,
  MenuDivider,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Switch,
  ToolbarButton,
  Tooltip,
} from '@fluentui/react-components';
import {
  Book20Regular,
  Building20Regular,
  CalendarLtr20Regular,
  ChartMultiple20Regular,
  Color20Regular,
  Document20Regular,
  DocumentAdd20Regular,
  DocumentSettings20Regular,
  Mail20Regular,
  PeopleTeam20Regular,
  Person24Filled,
  Receipt20Regular,
  Sparkle20Filled,
} from '@fluentui/react-icons';
import type { DocMeta, DocSpec, FontName, PageSize, ThemeName } from '../types';
import { THEME_LIST } from '../themes';
import * as T from '../ai/templates';
import { DEFAULT_META, today } from '../normalize';

export function ThemeMenu({ meta, onMeta }: { meta: DocMeta; onMeta: (m: Partial<DocMeta>) => void }) {
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content="Document theme" relationship="label">
          <ToolbarButton icon={<Color20Regular />}>
            <span className="swatch-dot" style={{ background: THEME_LIST.find((t) => t.name === meta.theme)?.primary }} />
          </ToolbarButton>
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuGroupHeader>Theme</MenuGroupHeader>
          {THEME_LIST.map((t) => (
            <MenuItem
              key={t.name}
              onClick={() => onMeta({ theme: t.name as ThemeName })}
              icon={
                <span className="swatch">
                  <i style={{ background: t.primary }} />
                  <i style={{ background: t.accent }} />
                  <i style={{ background: t.coverBg }} />
                </span>
              }
              secondaryContent={meta.theme === t.name ? '✓' : undefined}
            >
              {t.label}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

export function PageSetup({ meta, onMeta }: { meta: DocMeta; onMeta: (m: Partial<DocMeta>) => void }) {
  return (
    <Popover positioning="below-end" withArrow>
      <PopoverTrigger disableButtonEnhancement>
        <Tooltip content="Page setup" relationship="label">
          <ToolbarButton icon={<DocumentSettings20Regular />} />
        </Tooltip>
      </PopoverTrigger>
      <PopoverSurface className="page-setup">
        <div className="grid2">
          <Field label="Page size" size="small">
            <Dropdown size="small" value={meta.pageSize} selectedOptions={[meta.pageSize]} onOptionSelect={(_, d) => onMeta({ pageSize: d.optionValue as PageSize })}>
              {['A4', 'LETTER', 'LEGAL', 'A5'].map((s) => (
                <Option key={s} value={s}>
                  {s}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Orientation" size="small">
            <Dropdown size="small" value={meta.orientation} selectedOptions={[meta.orientation]} onOptionSelect={(_, d) => onMeta({ orientation: d.optionValue as 'portrait' | 'landscape' })}>
              <Option value="portrait">portrait</Option>
              <Option value="landscape">landscape</Option>
            </Dropdown>
          </Field>
          <Field label="Font" size="small">
            <Dropdown size="small" value={{ sans: 'Inter (sans)', serif: 'Merriweather (serif)', mono: 'JetBrains Mono' }[meta.font]} selectedOptions={[meta.font]} onOptionSelect={(_, d) => onMeta({ font: d.optionValue as FontName })}>
              <Option value="sans">Inter (sans)</Option>
              <Option value="serif">Merriweather (serif)</Option>
              <Option value="mono">JetBrains Mono</Option>
            </Dropdown>
          </Field>
          <Field label="Author" size="small">
            <Input size="small" value={meta.author ?? ''} onChange={(_, d) => onMeta({ author: d.value || undefined })} />
          </Field>
          <Field label="Subtitle" size="small" className="span2">
            <Input size="small" value={meta.subtitle ?? ''} onChange={(_, d) => onMeta({ subtitle: d.value || undefined })} />
          </Field>
          <Field label="Header text" size="small">
            <Input size="small" value={meta.header ?? ''} placeholder="auto" onChange={(_, d) => onMeta({ header: d.value || undefined })} />
          </Field>
          <Field label="Footer text" size="small">
            <Input size="small" value={meta.footer ?? ''} onChange={(_, d) => onMeta({ footer: d.value || undefined })} />
          </Field>
          <Field label="Date" size="small" className="span2">
            <Input size="small" value={meta.date ?? ''} onChange={(_, d) => onMeta({ date: d.value || undefined })} />
          </Field>
        </div>
        <Divider className="my8" />
        <div className="grid2">
          <Switch label="Cover page" checked={meta.cover} onChange={(_, d) => onMeta({ cover: d.checked })} />
          <Switch label="Table of contents" checked={meta.toc} onChange={(_, d) => onMeta({ toc: d.checked })} />
          <Switch label="Page numbers" checked={meta.pageNumbers} onChange={(_, d) => onMeta({ pageNumbers: d.checked })} />
          <Switch label="Numbered headings" checked={!!meta.numberedHeadings} onChange={(_, d) => onMeta({ numberedHeadings: d.checked })} />
        </div>
      </PopoverSurface>
    </Popover>
  );
}

const TEMPLATES: { label: string; icon: JSX.Element; build: () => DocSpec }[] = [
  { label: 'Blank document', icon: <Document20Regular />, build: () => ({ meta: { ...DEFAULT_META, date: today() }, blocks: [] }) },
  { label: 'Feature tour', icon: <Sparkle20Filled />, build: T.buildWelcome },
  { label: 'Annual report', icon: <ChartMultiple20Regular />, build: () => T.buildReport('your organization') },
  { label: 'Business proposal', icon: <Building20Regular />, build: () => T.buildProposal('digital transformation') },
  { label: 'Project plan', icon: <CalendarLtr20Regular />, build: () => T.buildProjectPlan('product launch') },
  { label: 'Study guide', icon: <Book20Regular />, build: () => T.buildStudyGuide('machine learning') },
  { label: 'Résumé', icon: <Person24Filled />, build: () => T.buildResume('Alex Morgan', 'Product Designer') },
  { label: 'Invoice', icon: <Receipt20Regular />, build: () => T.buildInvoice('Contoso Ltd') },
  { label: 'Meeting notes', icon: <PeopleTeam20Regular />, build: () => T.buildMeeting('quarterly planning') },
  { label: 'Letter', icon: <Mail20Regular />, build: () => T.buildLetter('Application for Senior Designer') },
];

export function NewMenu({ onPick }: { onPick: (d: DocSpec) => void }) {
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content="New from template" relationship="label">
          <ToolbarButton icon={<DocumentAdd20Regular />}>New</ToolbarButton>
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuGroupHeader>Start from</MenuGroupHeader>
          {TEMPLATES.slice(0, 2).map((t) => (
            <MenuItem key={t.label} icon={t.icon} onClick={() => onPick(t.build())}>
              {t.label}
            </MenuItem>
          ))}
          <MenuDivider />
          <MenuGroupHeader>Templates</MenuGroupHeader>
          {TEMPLATES.slice(2).map((t) => (
            <MenuItem key={t.label} icon={t.icon} onClick={() => onPick(t.build())}>
              {t.label}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
