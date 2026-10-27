import { ArrowDown, ArrowUp, ChevronLeft, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useJournal, useMistakeName, useStore } from '../../app/journal'
import { routeHref } from '../../app/router'
import { TAG_COLORS, type MistakeTag, type SetupTag } from '../../core/models'
import { Button, Card, SectionHeader } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { PageHeader } from '../shell/PageHeader'

type Kind = 'mistakes' | 'setups'

/** Rename, recolor, hide, reorder and add mistake and setup tags (SPEC section 9, principle 3). */
export function TagsPage() {
  const { t } = useI18n()
  const { mistakes, setups } = useJournal()
  return (
    <>
      <PageHeader
        title={t('tags.title')}
        leading={
          <a className="back-link" href={routeHref({ name: 'profile' })}>
            <ChevronLeft size={20} aria-hidden="true" />
            {t('tab.profile')}
          </a>
        }
      />
      <SectionHeader title={t('entry.mistakes')} />
      <TagList kind="mistakes" tags={mistakes} />
      <SectionHeader title={t('entry.setups')} />
      <TagList kind="setups" tags={setups} />
    </>
  )
}

function TagList({ kind, tags }: { kind: Kind; tags: readonly (MistakeTag | SetupTag)[] }) {
  const { t } = useI18n()
  const store = useStore()
  const [name, setName] = useState('')

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    await (kind === 'mistakes' ? store.addMistake(name) : store.addSetup(name))
    setName('')
  }

  const move = (index: number, offset: -1 | 1) => {
    const ids = tags.map((tag) => tag.id)
    const target = index + offset
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    void store.reorderTags(kind, ids)
  }

  return (
    <Card className="form-stack">
      {tags.length === 0 && <p className="secondary-text">{t('tags.noSetups')}</p>}
      {tags.length > 0 && (
        <ul className="tag-list">
          {tags.map((tag, index) => (
            <TagRow key={tag.id} kind={kind} tag={tag} first={index === 0} last={index === tags.length - 1} onMove={(offset) => move(index, offset)} />
          ))}
        </ul>
      )}
      <form className="rule-add" onSubmit={add}>
        <input
          className="input"
          aria-label={t(kind === 'mistakes' ? 'tags.newMistake' : 'tags.newSetup')}
          placeholder={t(kind === 'mistakes' ? 'tags.newMistake' : 'tags.newSetup')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" variant="primary" icon={<Plus size={18} aria-hidden="true" />} disabled={!name.trim()}>
          {t('accounts.add')}
        </Button>
      </form>
    </Card>
  )
}

function TagRow({ kind, tag, first, last, onMove }: { kind: Kind; tag: MistakeTag | SetupTag; first: boolean; last: boolean; onMove: (offset: -1 | 1) => void }) {
  const { t } = useI18n()
  const store = useStore()
  const mistakeName = useMistakeName()
  const isSystem = 'isSystem' in tag && tag.isSystem
  // A system tag's empty name means "use the translated default".
  const defaultName = isSystem ? mistakeName({ ...(tag as MistakeTag), name: '' }) : ''
  const [name, setName] = useState(tag.name)
  const [picking, setPicking] = useState(false)

  const save = (patch: Partial<MistakeTag & SetupTag>) =>
    kind === 'mistakes' ? store.saveMistake({ ...(tag as MistakeTag), ...patch }) : store.saveSetup({ ...(tag as SetupTag), ...patch })

  const saveName = () => {
    const trimmed = name.trim()
    if (!trimmed && !isSystem) return setName(tag.name)
    if (trimmed !== tag.name) void save({ name: trimmed })
  }

  return (
    <li className={`tag-row${tag.isArchived ? ' tag-row--hidden' : ''}`}>
      <button
        type="button"
        className="tag-row__color"
        style={{ background: tag.colorHex }}
        aria-label={t('tags.changeColor')}
        aria-expanded={picking}
        onClick={() => setPicking(!picking)}
      />
      <input
        className="input tag-row__name"
        aria-label={t('limits.ruleText')}
        value={name}
        placeholder={defaultName}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
      />
      <div className="rule-row__actions">
        <button type="button" className="icon-button" aria-label={t('accounts.moveUp')} disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" aria-label={t('accounts.moveDown')} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={tag.isArchived ? t('tags.show') : t('tags.hide')}
          aria-pressed={tag.isArchived}
          onClick={() => void save({ isArchived: !tag.isArchived })}
        >
          {tag.isArchived ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
        {!isSystem && (
          <button
            type="button"
            className="icon-button icon-button--danger"
            aria-label={t('action.delete')}
            onClick={() => window.confirm(t('tags.deleteConfirm')) && void store.deleteTag(kind, tag.id)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {picking && (
        <div className="color-picker tag-row__colors">
          {TAG_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="color-picker__swatch"
              style={{ background: color }}
              aria-label={color}
              aria-pressed={color === tag.colorHex}
              onClick={() => {
                void save({ colorHex: color })
                setPicking(false)
              }}
            />
          ))}
        </div>
      )}
    </li>
  )
}
