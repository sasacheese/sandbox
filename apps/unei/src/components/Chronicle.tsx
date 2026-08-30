import { useMemo } from 'react';
import { dateTime } from '../lib/format.ts';
import { useStore } from '../store.tsx';

type Entry = { at: string; mark: string; title: string; oracle: boolean; meta?: string; stamp?: 'accepted' | 'rejected'; image?: string };

/**
 * 年代記。指令・報告・裁定・布告が一本の時系列に並ぶ。
 *
 * 投稿一覧ではなく**記録**として組んでいる。誰が書いたかの欄が無く、
 * 主語はほぼ運営。人間の側の記録は「報告」の行だけで、それも数と一言しか残らない。
 * この非対称が積み上がっていくのが、この作品でいちばん効く画面だと思っている。
 */
export function Chronicle() {
  const { directives, decrees, realm } = useStore();

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const d of directives) {
      out.push({
        at: d.issuedAt,
        mark: '指令',
        oracle: true,
        title: `${d.place} / ${d.condition}`,
        meta: `${d.minPeople} 人以上`,
      });
      if (d.report) {
        out.push({
          at: d.report.at,
          mark: '報告',
          oracle: false,
          title: d.report.note || '（記述なし）',
          meta: `${d.report.people} 人`,
          ...(d.report.imageUrl ? { image: d.report.imageUrl } : {}),
        });
      }
      if (d.verdict) {
        out.push({
          at: d.verdict.at,
          mark: '裁定',
          oracle: true,
          title: d.verdict.text,
          stamp: d.verdict.accepted ? 'accepted' : 'rejected',
        });
      }
      if (d.status === 'missed') {
        out.push({ at: d.gatherAt, mark: '欠', oracle: true, title: '誰も来なかった。', stamp: 'rejected' });
      }
    }
    for (const decree of decrees) out.push({ at: decree.at, mark: '布告', oracle: true, title: decree.text });
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [decrees, directives]);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="realm">年代記</span>
        <span className="label">{entries.length} 件</span>
      </header>

      {entries.length === 0 ? (
        <div className="empty">まだ何も起きていない。</div>
      ) : (
        <div className="rows">
          {entries.map((entry, i) => (
            <div className="row" key={`${entry.at}-${i}`}>
              <span className="row__mark">{entry.mark}</span>
              <div className="row__body">
                <div className={`row__title${entry.oracle ? ' row__title--oracle' : ''}`}>
                  {entry.stamp ? (
                    <span className={`stamp stamp--${entry.stamp}`}>{entry.stamp === 'accepted' ? '受理' : '却下'}</span>
                  ) : null}
                  {entry.title}
                </div>
                {entry.image ? <img className="photo" src={entry.image} alt="" /> : null}
                <div className="row__meta">
                  {dateTime(entry.at)}
                  {entry.meta ? ` · ${entry.meta}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {realm.silenced.length > 0 ? <p className="sub">沈黙を命じられている：{realm.silenced.join('、')}</p> : null}
    </div>
  );
}
