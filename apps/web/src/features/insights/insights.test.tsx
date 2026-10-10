import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { App } from '@/App';
import { labelIndexes, niceMax, ratio } from '@/shared/ui/molecules/charts/scale';
import { API_URL, buildSalesSummary, errorEnvelope } from '@/test/builders';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/server';
import { compactMoney, dayLabel, hasActivity, parseRange, parseTab, percent } from './insights';

function renderInsights(route = '/insights') {
  const user = userEvent.setup({ delay: null });
  return { user, ...renderWithProviders(<App />, { route }) };
}

const chart = (name: string) => screen.findByRole('region', { name });

describe('insights helpers', () => {
  it('labels a day without letting a time zone move it', () => {
    expect(dayLabel('2026-10-09')).toBe('9 Oct');
    expect(dayLabel('2026-01-31')).toBe('31 Jan');
    expect(dayLabel('nonsense')).toBe('nonsense');
  });

  it('formats shares and short amounts', () => {
    expect(percent(0.756)).toBe('76%');
    expect(percent(7)).toBe('100%');
    expect(percent(Number.NaN)).toBe('0%');
    expect(compactMoney(125_000_000)).toBe('$1.3M');
    expect(compactMoney(0)).toBe('$0');
  });

  it('AC-5: reads the period and the report from the address, with safe defaults', () => {
    expect(parseRange('30')).toBe(30);
    expect(parseRange('31')).toBe(14);
    expect(parseRange(null)).toBe(14);
    expect(parseTab('payments')).toBe('payments');
    expect(parseTab('secrets')).toBe('sales');
  });

  it('AC-7: there is activity when at least one payment was attempted', () => {
    const empty = buildSalesSummary();
    empty.totals = { ...empty.totals, totalAttempts: 0 };

    expect(hasActivity(buildSalesSummary())).toBe(true);
    expect(hasActivity(empty)).toBe(false);
  });

  it('picks a round maximum for an axis', () => {
    expect([0, 1, 13, 20, 37, 501, 40_080_000].map(niceMax)).toEqual([
      1, 1, 20, 20, 50, 1000, 50_000_000,
    ]);
    expect(niceMax(Number.NaN)).toBe(1);
  });

  it('keeps a share between 0 and 1', () => {
    expect(ratio(5, 10)).toBe(0.5);
    expect(ratio(50, 10)).toBe(1);
    expect(ratio(-5, 10)).toBe(0);
    expect(ratio(5, 0)).toBe(0);
  });

  it('prints at most a handful of axis labels, always the last one', () => {
    expect(labelIndexes(7, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(labelIndexes(30, 7)).toEqual([4, 9, 14, 19, 24, 29]);
    expect(labelIndexes(0, 7)).toEqual([]);
  });
});

describe('Insights', () => {
  it('AC-5: opens on sales with the headline figures and one column per day', async () => {
    renderInsights();

    expect(await screen.findByRole('heading', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sales' })).toHaveAttribute('aria-selected', 'true');
    const revenue = await chart('Revenue per day');
    expect(within(revenue).getAllByTestId('chart-column')).toHaveLength(7);
    expect(
      within(revenue).getByRole('img', { name: /Revenue per day over the last 7 days/ }),
    ).toBeInTheDocument();

    for (const [label, value] of [
      ['Revenue', /601\.200/],
      ['Approved orders', '3'],
      ['Average order', /200\.400/],
      ['Units sold', '4'],
    ] as const) {
      expect(screen.getByText(label).parentElement).toHaveTextContent(value);
    }
  });

  it('AC-5: changing the period asks for it and keeps it in the address', async () => {
    const asked: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/reports/summary`, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('days'));
        return HttpResponse.json({ data: buildSalesSummary() });
      }),
    );
    const { user } = renderInsights();
    await chart('Revenue per day');

    await user.click(screen.getByRole('button', { name: '30 days' }));

    expect(await screen.findByText('Store activity over the last 30 days.')).toBeInTheDocument();
    expect(asked).toEqual(['14', '30']);
    expect(screen.getByTestId('location')).toHaveTextContent('/insights?tab=sales&days=30');
  });

  it('AC-6: products ranks the best sellers with revenue and units', async () => {
    const { user } = renderInsights();
    await chart('Revenue per day');

    await user.click(screen.getByRole('tab', { name: 'Products' }));

    const top = await chart('Top products');
    const rows = within(top).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Aurora Desk Lamp');
    expect(rows[0]).toHaveTextContent('3 units');
    expect(rows[0]).toHaveTextContent(/460\.800/);
    expect(rows[1]).toHaveTextContent('1 unit');
    expect(screen.getByTestId('location')).toHaveTextContent('tab=products');
  });

  it('AC-6: payments shows the approval rate, every status and both card brands', async () => {
    renderInsights('/insights?tab=payments&days=7');

    const outcomes = await chart('Payment outcomes');
    expect(within(outcomes).getByRole('img', { name: 'Approval rate: 75%' })).toBeInTheDocument();
    expect(
      within(outcomes)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Approved3', 'Declined1', 'Failed0', 'Voided0', 'Processing1']);

    const brands = await chart('Card brands');
    expect(within(brands).getByText('Attempts')).toBeInTheDocument();
    expect(within(brands).getByText('Approved')).toBeInTheDocument();
    const [visa, mastercard] = within(brands).getAllByRole('listitem');
    expect(visa).toHaveTextContent('VISA');
    expect(visa).toHaveTextContent('4 attempts');
    expect(visa).toHaveTextContent('3 approved');
    expect(mastercard).toHaveTextContent('0 approved');
  });

  it('AC-6: every chart can be read as a table', async () => {
    const { user } = renderInsights('/insights?days=7');
    const revenue = await chart('Revenue per day');

    await user.click(within(revenue).getByRole('button', { name: 'Show table' }));

    const table = within(revenue).getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Day', 'Revenue', 'Orders']);
    expect(within(table).getByRole('row', { name: /10 Oct .*400\.800 2/ })).toBeInTheDocument();
    expect(within(revenue).queryByRole('img')).not.toBeInTheDocument();

    await user.click(within(revenue).getByRole('button', { name: 'Show chart' }));
    expect(within(revenue).getByRole('img')).toBeInTheDocument();
  });

  it('AC-7: a failed read can be retried', async () => {
    server.use(
      http.get(
        `${API_URL}/reports/summary`,
        () => HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
        { once: true },
      ),
    );
    const { user } = renderInsights();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not load the reports.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await chart('Revenue per day')).toBeInTheDocument();
  });

  it('AC-7: a period without payments says so and still draws empty reports', async () => {
    const quiet = buildSalesSummary({
      topProducts: [],
      salesByDay: buildSalesSummary().salesByDay.map((day) => ({
        ...day,
        revenueInCents: 0,
        orders: 0,
      })),
    });
    quiet.totals = {
      revenueInCents: 0,
      approvedOrders: 0,
      unitsSold: 0,
      averageOrderInCents: 0,
      totalAttempts: 0,
      approvalRate: 0,
    };
    server.use(http.get(`${API_URL}/reports/summary`, () => HttpResponse.json({ data: quiet })));
    const { user } = renderInsights();

    expect(await screen.findByText('There were no payments in this period.')).toBeInTheDocument();
    expect(within(await chart('Revenue per day')).getAllByTestId('chart-column')).toHaveLength(7);

    await user.click(screen.getByRole('tab', { name: 'Products' }));
    expect(await screen.findByText('No approved payments in this period.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Payments' }));
    expect(await screen.findByRole('img', { name: 'Approval rate: 0%' })).toBeInTheDocument();
    expect(screen.queryByTestId('meter-arc')).not.toBeInTheDocument();
  });
});
