const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;
let warnedAboutFallback = false;

function ensureTable(store, table) {
  if (!store[table]) {
    store[table] = [];
  }
  return store[table];
}

function createMemoryClient() {
  const store = {};

  function makeFilterMatcher(filters) {
    return (row) => filters.every((filter) => row[filter.column] === filter.value);
  }

  function createBuilder(table) {
    const state = {
      mode: 'select',
      insertRows: [],
      filters: [],
      countMode: null,
      head: false,
      orderColumn: null,
      orderAscending: true,
      limitCount: null,
    };

    return {
      insert(payload) {
        state.mode = 'insert';
        state.insertRows = Array.isArray(payload) ? payload : [payload];
        return this;
      },
      delete() {
        state.mode = 'delete';
        return this;
      },
      select(_columns, options = {}) {
        if (state.mode !== 'insert' && state.mode !== 'delete') {
          state.mode = 'select';
        }
        state.countMode = options.count || null;
        state.head = Boolean(options.head);
        return this;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        return this;
      },
      order(column, options = {}) {
        state.orderColumn = column;
        state.orderAscending = options.ascending !== false;
        return this;
      },
      limit(count) {
        state.limitCount = Number(count) || null;
        return this;
      },
      async single() {
        const result = await this.maybeSingle();
        if (!result.data) {
          return { data: null, error: { message: 'No rows found.' } };
        }
        return result;
      },
      async maybeSingle() {
        const rows = ensureTable(store, table);

        if (state.mode === 'insert') {
          for (const row of state.insertRows) {
            rows.push({ ...row });
          }
          return { data: state.insertRows[0] || null, error: null };
        }

        if (state.mode === 'delete') {
          const matcher = makeFilterMatcher(state.filters);
          const idx = rows.findIndex(matcher);
          if (idx === -1) {
            return { data: null, error: null };
          }
          const [removed] = rows.splice(idx, 1);
          return { data: removed || null, error: null };
        }

        const matcher = makeFilterMatcher(state.filters);
        let filtered = rows.filter(matcher);

        if (state.orderColumn) {
          filtered = [...filtered].sort((left, right) => {
            const leftValue = left?.[state.orderColumn];
            const rightValue = right?.[state.orderColumn];

            if (leftValue === rightValue) {
              return 0;
            }

            const direction = state.orderAscending ? 1 : -1;
            return leftValue > rightValue ? direction : -direction;
          });
        }

        if (state.limitCount) {
          filtered = filtered.slice(0, state.limitCount);
        }

        if (state.countMode === 'exact' && state.head) {
          return { data: null, count: filtered.length, error: null };
        }

        return { data: filtered[0] || null, error: null };
      },
    };
  }

  return {
    __isMemory: true,
    from(table) {
      return createBuilder(table);
    },
  };
}

function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const url = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const key = serviceRoleKey || anonKey;

  if (process.env.NODE_ENV === 'production' && (!url || !key)) {
    throw new Error('Supabase credentials are not configured.');
  }

  if (url && key) {
    cachedClient = createClient(url, key);
    cachedClient.__isMemory = false;
    return cachedClient;
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn('Supabase credentials are missing. Falling back to in-memory storage.');
  }

  cachedClient = createMemoryClient();
  return cachedClient;
}

module.exports = {
  getSupabaseClient,
};
