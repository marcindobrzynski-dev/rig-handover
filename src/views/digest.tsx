import { rowWarnings } from '../digest/row-warnings.js';
import type { ReadNightResult } from '../digest/types.js';
import { MISSING } from '../digest/constants.js';

function badLinesText(count: number) {
  return `${count} bad ${count === 1 ? 'line' : 'lines'}`;
}

export function DigestPage({ night, digest }: { night: string; digest: ReadNightResult }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">{badLinesText(digest.badLinesCount)}</p>
      {digest.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const warnings = rowWarnings(row);

              return (
                <tr class={warnings.length > 0 ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? MISSING}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>
                    {row.lastError ?? MISSING}
                    {warnings.length > 0 && ` 🚩 ${warnings.join(', ')}`}
                  </td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
