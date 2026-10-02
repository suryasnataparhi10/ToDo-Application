import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchExpenses, fetchSummary, removeExpense, removeExpenses } from '../state/store';
import ExpenseModal from '../components/ExpenseModal';
import PaymentMethodSelect, { PaymentMethodBadge } from '../components/PaymentMethodSelect';
import { PAY, today, fmtDate, inr } from '../utils';
import CalendarInput from '../components/CalendarInput';

export default function Expenses() {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch(),
    { data: list, loading } = useSelector((s) => s.exp),
    [query, setQuery] = useState({
      search: searchParams.get('search') || '',
      paymentMethod: '',
      month: searchParams.get('search') ? '' : today().slice(0, 7),
    }),
    [modal, setModal] = useState(null),
    [toDelete, setToDelete] = useState(null),
    [expandedSubtypeIds, setExpandedSubtypeIds] = useState(() => new Set()),
    [selectedExpenseIds, setSelectedExpenseIds] = useState(() => new Set());
  const load = () => {
    const { month, ...filters } = query,
      params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    if (month && !filters.search) {
      params.year = month.slice(0, 4);
      params.month = Number(month.slice(5));
    }
    dispatch(fetchExpenses(params));
  };
  useEffect(() => {
    const search = searchParams.get('search') || '';
    setQuery((current) =>
      current.search === search
        ? current
        : { ...current, search, ...(search ? { month: '' } : {}) },
    );
  }, [searchParams]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => setSelectedExpenseIds(new Set()), [query]);
  const setFilter = (key) => (event) => setQuery({ ...query, [key]: event.target.value });
  const visible = list || [],
    monthTotal = visible.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const visibleIds = visible.map((expense) => expense._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedExpenseIds.has(id));
  const deleteSelectedExpenses = async () => {
    const ids = [...selectedExpenseIds];
    if (
      !ids.length ||
      !window.confirm(`Delete ${ids.length} selected expense${ids.length === 1 ? '' : 's'}?`)
    )
      return;
    try {
      await dispatch(removeExpenses(ids)).unwrap();
      setSelectedExpenseIds(new Set());
      load();
      const selected = query.month ? new Date(`${query.month}-01T00:00:00`) : new Date();
      dispatch(fetchSummary({ month: selected.getMonth() + 1, year: selected.getFullYear() }));
    } catch {}
  };
  const groups = visible.reduce((result, expense) => {
    const day = expense.date.slice(0, 10);
    (result[day] = result[day] || []).push(expense);
    return result;
  }, {});
  const monthName = query.month
    ? new Date(
        Number(query.month.slice(0, 4)),
        Number(query.month.slice(5, 7)) - 1,
      ).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'All dates';

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPENDING HISTORY</span>
          <h1>Expenses</h1>
          <p className="muted">Find, review, and update your items.</p>
        </div>
        <button className="btn btn-primary add-button" onClick={() => setModal({})}>
          <i className="bi bi-plus-lg" /> Add expense
        </button>
      </div>
      <section className="filter-panel">
        <div className="search-wrap">
          <i className="bi bi-search" />
          <input
            className="form-control"
            placeholder="Search items..."
            value={query.search}
            onChange={setFilter('search')}
          />
        </div>
        <CalendarInput
          type="month"
          aria-label="Filter by month"
          className="month-filter"
          value={query.month}
          onChange={setFilter('month')}
        />
        <PaymentMethodSelect
          ariaLabel="Filter by payment method"
          className="payment-filter"
          value={query.paymentMethod || 'All payment methods'}
          options={['All payment methods', ...PAY]}
          onChange={(paymentMethod) =>
            setQuery({ ...query, paymentMethod: paymentMethod === 'All payment methods' ? '' : paymentMethod })
          }
        />
      </section>
      <section className="month-summary">
        <div>
          <span className="eyebrow">MONTH TOTAL</span>
          <b>{monthName}</b>
          <small>Current search and payment filters applied</small>
        </div>
        <strong>{inr(monthTotal)}</strong>
      </section>
      {!!visible.length && (
        <div className="bulk-toolbar">
          <label className="bulk-select-all">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() =>
                setSelectedExpenseIds(allVisibleSelected ? new Set() : new Set(visibleIds))
              }
            />
            Select all visible
          </label>
          <span>{selectedExpenseIds.size} selected</span>
          <button
            className="bulk-delete-button"
            disabled={!selectedExpenseIds.size}
            onClick={deleteSelectedExpenses}
          >
            <i className="bi bi-trash3" /> Delete selected
          </button>
        </div>
      )}
      {loading && !list ? (
        <div className="text-center py-5">
          <div className="spinner-border" />
        </div>
      ) : !Object.keys(groups).length ? (
        <div className="panel no-expenses">
          <span className="empty-icon">
            <i className="bi bi-receipt" />
          </span>
          <h4>No expenses found</h4>
          <p className="muted">Try another month or add an expense to get started.</p>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            Add expense
          </button>
        </div>
      ) : (
        <div className="expense-groups">
          {Object.entries(groups).map(([day, items]) => (
            <section className="panel day-group" key={day}>
              <div className="day-heading">
                <div>
                  <span className="eyebrow">
                    {new Date(day).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      timeZone: 'UTC',
                    })}
                  </span>
                  <h4>{fmtDate(day)}</h4>
                </div>
                <div className="day-total">
                  <small>DAY TOTAL</small>
                  <b>{inr(items.reduce((sum, expense) => sum + expense.amount, 0))}</b>
                </div>
              </div>
              <div className="day-list">
                {items.map((expense) => (
                  <div key={expense._id}>
                    <div className="expense-row">
                      <input
                        className="bulk-row-checkbox"
                        type="checkbox"
                        aria-label={`Select ${expense.item || expense.description}`}
                        checked={selectedExpenseIds.has(expense._id)}
                        onChange={() =>
                          setSelectedExpenseIds((current) => {
                            const next = new Set(current);
                            if (next.has(expense._id)) next.delete(expense._id);
                            else next.add(expense._id);
                            return next;
                          })
                        }
                      />
                      <span className="expense-icon">
                        <i className="bi bi-bag" />
                      </span>
                      <div className="expense-info">
                        <b>{expense.item || expense.description}</b>
                        <small>
                          {expense.category || 'Other'}
                          {expense.hasSubtypes && expense.subtypes?.length
                            ? ` · ${expense.subtypes.length} subtypes`
                            : null}
                        </small>
                        {!expense.hasSubtypes && (
                          <PaymentMethodBadge method={expense.paymentMethod || 'Cash'} />
                        )}
                      </div>
                      <b className="expense-amount">{inr(expense.amount)}</b>
                      <div className="expense-tools">
                        <button
                          className="icon-button"
                          aria-label="Edit expense"
                          onClick={() => setModal(expense)}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label="Delete expense"
                          onClick={() => setToDelete(expense)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </div>
                    {expense.hasSubtypes && expense.subtypes?.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="subtype-accordion-trigger"
                          aria-expanded={expandedSubtypeIds.has(expense._id)}
                          onClick={() =>
                            setExpandedSubtypeIds((current) => {
                              const next = new Set(current);
                              if (next.has(expense._id)) next.delete(expense._id);
                              else next.add(expense._id);
                              return next;
                            })
                          }
                        >
                          <span>
                            {expandedSubtypeIds.has(expense._id)
                              ? 'Hide breakdown'
                              : 'View breakdown'}
                          </span>
                          <span className="subtype-count">{expense.subtypes.length} parts</span>
                          <i
                            className={`bi ${expandedSubtypeIds.has(expense._id) ? 'bi-dash-lg' : 'bi-plus-lg'}`}
                            aria-hidden="true"
                          />
                        </button>
                        {expandedSubtypeIds.has(expense._id) && (
                          <div className="expense-subtypes">
                            {expense.subtypes.map((sub, i) => (
                              <div key={`${expense._id}-${i}`}>
                                <span>{sub.type}</span>
                                <PaymentMethodBadge method={sub.paymentMethod || 'Cash'} />
                                <b>{inr(sub.amount)}</b>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {modal && (
        <ExpenseModal
          item={modal}
          history={list || []}
          onClose={() => setModal(null)}
          onSaved={() => {
            load();
            const selected = query.month ? new Date(`${query.month}-01T00:00:00`) : new Date();
            dispatch(
              fetchSummary({ month: selected.getMonth() + 1, year: selected.getFullYear() }),
            );
          }}
        />
      )}
      {toDelete && (
        <div className="modal d-block modal-backdrop-custom">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content expense-modal">
              <div className="modal-body p-4">
                <span className="eyebrow">REMOVE EXPENSE</span>
                <h5 className="mt-2">Delete this expense?</h5>
                <p className="muted mb-0">This will remove it from your expense history.</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setToDelete(null)}>
                  Keep expense
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() =>
                    dispatch(removeExpense(toDelete._id))
                      .unwrap()
                      .then(() => {
                        setToDelete(null);
                        setSelectedExpenseIds((current) => {
                          const next = new Set(current);
                          next.delete(toDelete._id);
                          return next;
                        });
                        load();
                      })
                      .catch(() => setToDelete(null))
                  }
                >
                  Delete expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
