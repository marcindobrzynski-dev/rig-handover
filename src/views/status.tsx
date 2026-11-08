import type { NightCounts } from '../digest/types.js';
import type { Status } from '../status.js';
import { MISSING } from '../digest/constants.js';

function countsText(counts: NightCounts | null) {
  if (!counts) return MISSING;

  return `${counts.ok} ok · ${counts.retried} retried · ${counts.fail} fail`;
}

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map(({ night, counts }) => (
            <li>
              <a href={`/digest/${night}`}>{night}</a>{' '}
              <span class="mute">{countsText(counts)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
