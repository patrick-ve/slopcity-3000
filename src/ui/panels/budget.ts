import { type Panel, pct, signed } from './panel';
import { UIWindow } from '../window';
import type { Game } from '../../game/game';
import { computeBudget } from '../../sim/budget';
import { clear, h } from '../../util/dom';
import { money } from '../../util/format';
import { type Department, DEPARTMENT_NAMES, DEPARTMENTS } from '../../sim/types';

// ===================================================================== budget

export class BudgetPanel implements Panel {
  win: UIWindow;
  constructor(
    private game: Game,
    host: HTMLElement,
  ) {
    this.win = new UIWindow(host, 'budget', 'Budget', 'budget', 600);
  }

  refresh(): void {
    const sim = this.game.sim;
    if (!sim || !this.win.open) return;
    const c = sim.city;
    const rep = computeBudget(sim);
    const b = this.win.body;
    const scroll = b.scrollTop;
    clear(b);
    const head = h(
      'div',
      { class: 'kv', style: 'margin-bottom:6px' },
      h('div', { class: 'k' }, 'Treasury'),
      h('div', { class: `v ${c.funds < 0 ? 'neg' : ''}` }, money(c.funds)),
      h('div', { class: 'k' }, 'Monthly cash flow'),
      h('div', { class: 'v', style: `color:${rep.total >= 0 ? 'var(--good)' : 'var(--bad)'}` }, signed(rep.total)),
      h('div', { class: 'k' }, 'Projected for the year'),
      h('div', { class: 'v' }, signed(rep.total * 12)),
    );
    b.appendChild(head);

    b.appendChild(h('div', { class: 'section-title' }, 'Income'));
    const taxRow = (key: 'R' | 'C' | 'I', label: string, color: string, revenue: number) => {
      const val = h('span', { class: 'v num', style: 'width:42px;text-align:right' }, `${c.tax[key]}%`);
      const slider = h('input', {
        type: 'range',
        min: 0,
        max: 20,
        step: 1,
        value: String(c.tax[key]),
        oninput: (e: Event) => {
          c.tax[key] = Number((e.target as HTMLInputElement).value);
          val.textContent = `${c.tax[key]}%`;
        },
        onchange: () => this.refresh(),
      });
      return h(
        'div',
        { class: 'row' },
        h('span', { style: `width:10px;height:10px;border-radius:3px;background:${color}` }),
        h('span', { class: 'k', style: 'flex:0 0 150px' }, label),
        slider,
        val,
        h('span', { class: 'v num pos', style: 'width:80px;text-align:right' }, money(revenue)),
      );
    };
    b.appendChild(taxRow('R', 'Residential tax', 'var(--r)', rep.income.resTax));
    b.appendChild(taxRow('C', 'Commercial tax', 'var(--c)', rep.income.comTax));
    b.appendChild(taxRow('I', 'Industrial tax', 'var(--i)', rep.income.indTax));
    if (rep.income.ordinances) b.appendChild(this.line('Ordinances', rep.income.ordinances, true));
    if (rep.income.deals) b.appendChild(this.line('Business deals', rep.income.deals, true));

    b.appendChild(h('div', { class: 'section-title' }, 'Expenses'));
    for (const d of DEPARTMENTS) b.appendChild(this.fundRow(d, rep.expense.departments[d]));
    b.appendChild(this.line('Utilities (plants, pumps, garbage)', -rep.expense.utilities));
    if (rep.expense.ordinances) b.appendChild(this.line('Ordinances', -rep.expense.ordinances));
    if (rep.expense.deals) b.appendChild(this.line('Neighbour deals', -rep.expense.deals));
    if (rep.expense.loans) b.appendChild(this.line('Bond payments', -rep.expense.loans));

    b.appendChild(h('div', { class: 'section-title' }, 'Bonds'));
    if (!c.loans.length)
      b.appendChild(
        h('div', { class: 'note' }, 'No outstanding bonds. Bonds give you cash now and are repaid over 10 years with interest.'),
      );
    for (const l of c.loans) {
      b.appendChild(
        h(
          'div',
          { class: 'row' },
          h(
            'span',
            { class: 'k' },
            `${money(l.principal)} at ${(l.rate * 100).toFixed(1)}% — ${money(l.payment)}/mo, ${money(l.remaining)} left`,
          ),
          h(
            'button',
            {
              class: 'btn small',
              disabled: c.funds < l.remaining,
              onclick: () => {
                if (sim.repayLoan(l.id)) this.game.sfx.play('cash');
                this.refresh();
              },
            },
            'Repay',
          ),
        ),
      );
    }
    const issue = h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' });
    for (const amt of [5000, 10000, 25000]) {
      issue.appendChild(
        h(
          'button',
          {
            class: 'btn small',
            disabled: c.loans.length >= 5,
            onclick: () => {
              if (sim.takeLoan(amt)) this.game.sfx.play('cash');
              this.refresh();
            },
          },
          `Issue ${money(amt)} bond`,
        ),
      );
    }
    b.appendChild(issue);
    b.scrollTop = scroll;
  }

  private line(label: string, amount: number, income = false): HTMLElement {
    return h(
      'div',
      { class: 'row' },
      h('span', { class: 'k' }, label),
      h('span', { class: `v num ${income ? 'pos' : amount < 0 ? 'neg' : ''}` }, income ? money(amount) : signed(amount)),
    );
  }

  private fundRow(d: Department, cost: number): HTMLElement {
    const c = this.game.sim!.city;
    const val = h('span', { class: 'v num', style: 'width:42px;text-align:right' }, pct(c.funding[d]));
    const slider = h('input', {
      type: 'range',
      min: 0,
      max: 120,
      step: 5,
      value: String(Math.round(c.funding[d] * 100)),
      oninput: (e: Event) => {
        c.funding[d] = Number((e.target as HTMLInputElement).value) / 100;
        val.textContent = pct(c.funding[d]);
        this.game.sim!.dirty.coverage = true;
      },
      onchange: () => this.refresh(),
    });
    return h(
      'div',
      { class: 'row' },
      h('span', { class: 'k', style: 'flex:0 0 160px' }, DEPARTMENT_NAMES[d]),
      slider,
      val,
      h('span', { class: 'v num neg', style: 'width:80px;text-align:right' }, money(-cost)),
    );
  }
}
