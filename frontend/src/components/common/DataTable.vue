<script setup>
import { computed, ref } from 'vue'
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsUpDown, Search } from '@lucide/vue'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const props = defineProps({
  columns: { type: Array, required: true },
  data: { type: Array, default: () => [] },
  searchable: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: 'Search…' },
  pageSize: { type: Number, default: 10 },
  rowClickable: { type: Boolean, default: false },
  initialSorting: { type: Array, default: () => [] },
  emptyText: { type: String, default: 'No data to display.' },
})

const emit = defineEmits(['row-click'])

const sorting = ref(props.initialSorting)
const globalFilter = ref('')
const expanded = ref({})

const tableColumns = computed(() => props.columns.map((column) => ({
  accessorKey: column.accessorKey,
  id: column.id || column.accessorKey,
  header: column.header,
  enableSorting: column.enableSorting !== false && Boolean(column.accessorKey),
  enableGlobalFilter: column.enableGlobalFilter !== false,
})))

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return tableColumns.value
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get globalFilter() {
      return globalFilter.value
    },
    get expanded() {
      return expanded.value
    },
  },
  globalFilterFn: 'includesString',
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === 'function' ? updater(globalFilter.value) : updater
  },
  onExpandedChange: (updater) => {
    expanded.value = typeof updater === 'function' ? updater(expanded.value) : updater
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: { pageSize: props.pageSize },
  },
})

const rows = computed(() => table.getRowModel().rows)
const showPagination = computed(() => table.getPageCount() > 1)
const columnSpan = computed(() => props.columns.length)

function sortIcon(column) {
  const direction = column.getIsSorted()

  if (direction === 'asc') {
    return ArrowUp
  }

  if (direction === 'desc') {
    return ArrowDown
  }

  return ChevronsUpDown
}

function onRowClick(row) {
  if (props.rowClickable) {
    emit('row-click', row.original)
  }
}

function onRowKeydown(event, row) {
  if (!props.rowClickable) {
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('row-click', row.original)
  }
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="searchable || $slots.toolbar"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <div
        v-if="searchable"
        class="relative w-full max-w-xs"
      >
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="globalFilter"
          :placeholder="searchPlaceholder"
          class="pl-8"
        />
      </div>
      <slot name="toolbar" />
    </div>

    <div class="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="bg-muted/50 hover:bg-muted/50"
          >
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <button
                v-if="header.column.getCanSort()"
                type="button"
                :aria-label="`Sort by ${header.column.columnDef.header}`"
                class="-ml-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <slot :name="`header-${header.column.id}`">{{ header.column.columnDef.header }}</slot>
                <component
                  :is="sortIcon(header.column)"
                  class="size-3.5 opacity-70"
                />
              </button>
              <slot
                v-else
                :name="`header-${header.column.id}`"
              >{{ header.column.columnDef.header }}</slot>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="rows.length">
            <template
              v-for="row in rows"
              :key="row.id"
            >
              <TableRow
                :class="cn(rowClickable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')"
                :data-state="row.getIsSelected() ? 'selected' : undefined"
                :tabindex="rowClickable ? 0 : undefined"
                :role="rowClickable ? 'button' : undefined"
                @click="onRowClick(row)"
                @keydown="onRowKeydown($event, row)"
              >
                <TableCell
                  v-for="cell in row.getVisibleCells()"
                  :key="cell.id"
                  class="py-3 align-top whitespace-normal wrap-break-word"
                >
                  <slot
                    :name="`cell-${cell.column.id}`"
                    :item="row.original"
                    :value="cell.getValue()"
                    :row="row"
                  >
                    {{ cell.getValue() ?? '—' }}
                  </slot>
                </TableCell>
              </TableRow>
              <TableRow
                v-if="row.getIsExpanded()"
                :key="`${row.id}-expanded`"
                class="hover:bg-transparent"
              >
                <TableCell
                  :colspan="columnSpan"
                  class="whitespace-normal bg-muted/30 p-0"
                >
                  <slot
                    name="expanded"
                    :item="row.original"
                    :row="row"
                  />
                </TableCell>
              </TableRow>
            </template>
          </template>
          <TableRow v-else>
            <TableCell
              :colspan="columnSpan"
              class="h-24 text-center text-sm text-muted-foreground"
            >
              {{ emptyText }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div
      v-if="showPagination"
      class="flex items-center justify-between gap-3"
    >
      <p class="text-xs text-muted-foreground">
        Page {{ table.getState().pagination.pageIndex + 1 }} of {{ table.getPageCount() }}
        · {{ table.getFilteredRowModel().rows.length }} rows
      </p>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          <ArrowLeft class="size-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()"
        >
          Next
          <ArrowRight class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
