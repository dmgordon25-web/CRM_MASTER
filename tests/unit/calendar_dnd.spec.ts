import { afterEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../crm-app/js/calendar_impl.js';

class FakeClassList {
  private owner: FakeElement;
  private set: Set<string> = new Set();

  constructor(owner: FakeElement){
    this.owner = owner;
  }

  add(...names: string[]): void {
    names.forEach((name) => {
      if(!name) return;
      this.set.add(name);
    });
    this.sync();
  }

  remove(...names: string[]): void {
    names.forEach((name) => {
      if(!name) return;
      this.set.delete(name);
    });
    this.sync();
  }

  contains(name: string): boolean {
    return this.set.has(name);
  }

  toggle(name: string, force?: boolean): boolean {
    const shouldAdd = force == null ? !this.set.has(name) : !!force;
    if(shouldAdd){
      this.set.add(name);
    }else{
      this.set.delete(name);
    }
    this.sync();
    return this.set.has(name);
  }

  private sync(): void {
    this.owner.className = Array.from(this.set).join(' ');
  }
}

class FakeElement {
  tagName: string;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  classList: FakeClassList;
  className = '';
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  textContent = '';
  attributes = new Map<string, string>();
  eventListeners = new Map<string, Set<(evt: any) => void>>();

  constructor(tag: string){
    this.tagName = tag.toUpperCase();
    this.classList = new FakeClassList(this);
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  removeChild(child: FakeElement): void {
    const idx = this.children.indexOf(child);
    if(idx >= 0){
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
  }

  remove(): void {
    if(this.parentElement){
      this.parentElement.removeChild(this);
    }
  }

  contains(other: FakeElement): boolean {
    if(this === other) return true;
    return this.children.some((child) => child.contains(other));
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.has(name) ? this.attributes.get(name)! : null;
  }

  addEventListener(type: string, handler: (evt: any) => void): void {
    if(!this.eventListeners.has(type)){
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(handler);
  }

  dispatchEvent(evt: any): void {
    const listeners = this.eventListeners.get(evt.type);
    if(!listeners) return;
    listeners.forEach((handler) => handler(evt));
  }

  querySelector(selector: string): FakeElement | null {
    if(selector.startsWith('.')){
      const className = selector.slice(1);
      if(this.classList.contains(className)) return this;
      for(const child of this.children){
        const match = child.querySelector(selector);
        if(match) return match;
      }
    }
    return null;
  }

  getBoundingClientRect(): { width: number; height: number } {
    return { width: 120, height: 40 };
  }
}

class FakeDocument {
  body: FakeElement;
  defaultView: any;
  readyState = 'complete';

  constructor(){
    this.body = new FakeElement('body');
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }

  getElementById(): null {
    return null;
  }

  querySelector(): null {
    return null;
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  dispatchEvent(): boolean {
    return true;
  }

  elementFromPoint(): FakeElement | null {
    return null;
  }
}

function ensureCustomEvent(): void {
  if(typeof (globalThis as any).CustomEvent === 'function') return;
  (globalThis as any).CustomEvent = class CustomEvent<T> extends Event {
    detail: T;
    constructor(name: string, params?: CustomEventInit<T>){
      super(name, params);
      this.detail = params?.detail as T;
    }
  };
}

async function loadCalendarModule(){
  vi.resetModules();
  ensureCustomEvent();
  const documentStub = new FakeDocument();
  const windowStub: any = { document: documentStub };
  documentStub.defaultView = windowStub;
  (globalThis as any).document = documentStub as unknown as Document;
  (globalThis as any).window = windowStub as typeof window;
  await import(MODULE_PATH);
  const testApi = windowStub.__CALENDAR_IMPL__.__test__;
  return { documentStub, windowStub, testApi };
}

afterEach(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

describe('calendar drag classification', () => {
  it('classifies user events as draggable and locks fixed events', async () => {
    const { testApi } = await loadCalendarModule();
    const normalize = testApi.normalizeEvent as (value: any) => any;
    const userEvent = normalize({ id: 'u1', date: '2025-05-01', title: 'User Event', userEvent: true });
    expect(userEvent.userEvent).toBe(true);
    expect(userEvent.draggable).toBe(true);
    expect(userEvent.fixed).toBe(false);

    const fixedEvent = normalize({ id: 'u2', date: '2025-05-02', title: 'Fixed', userEvent: true, fixed: true });
    expect(fixedEvent.userEvent).toBe(true);
    expect(fixedEvent.draggable).toBe(false);
    expect(fixedEvent.fixed).toBe(true);
  });

  it('prefers raw reschedule handlers when persisting a move', async () => {
    const { testApi, windowStub } = await loadCalendarModule();
    const normalize = testApi.normalizeEvent as (value: any) => any;
    const createSnapshot = testApi.createEventSnapshot as (value: any) => any;
    const persist = testApi.persistEventDate as (event: any, previous: any, next: any, options?: any) => Promise<any>;

    const rawHandler = vi.fn().mockResolvedValue({ ok: true });
    const original = normalize({ id: 'p1', date: '2025-03-04', title: 'Meeting', userEvent: true, onReschedule: rawHandler });
    const updatedDate = new Date(original.date.getTime() + 86400000);
    const updated = { ...original, date: updatedDate, raw: { ...original.raw, date: new Date(updatedDate.getTime()) } };
    const previous = createSnapshot(original);
    const next = createSnapshot(updated);

    const apiSpy = vi.fn().mockResolvedValue({ ok: true });
    windowStub.CalendarAPI = { updateEventDate: apiSpy };

    const result = await persist(updated, previous, next, { api: windowStub.CalendarAPI });
    expect(result.ok).toBe(true);
    expect(rawHandler).toHaveBeenCalledTimes(1);
    const payload = rawHandler.mock.calls[0][0];
    expect(payload).toMatchObject({ id: 'p1' });
    expect(payload.date).toBeInstanceOf(Date);
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it('falls back to CalendarAPI persistence when no raw handler exists', async () => {
    const { testApi, windowStub } = await loadCalendarModule();
    const normalize = testApi.normalizeEvent as (value: any) => any;
    const createSnapshot = testApi.createEventSnapshot as (value: any) => any;
    const persist = testApi.persistEventDate as (event: any, previous: any, next: any, options?: any) => Promise<any>;

    const original = normalize({ id: 'p2', date: '2025-03-05', title: 'Follow-up', userEvent: true });
    const updatedDate = new Date(original.date.getTime() + 86400000);
    const updated = { ...original, date: updatedDate, raw: original.raw };
    const previous = createSnapshot(original);
    const next = createSnapshot(updated);

    const apiSpy = vi.fn().mockResolvedValue({ ok: true });
    windowStub.CalendarAPI = { updateEventDate: apiSpy };

    const result = await persist(updated, previous, next, { api: windowStub.CalendarAPI });
    expect(result.ok).toBe(true);
    expect(apiSpy).toHaveBeenCalledTimes(1);
    const payload = apiSpy.mock.calls[0][0];
    expect(payload).toMatchObject({ id: 'p2' });
  });

  it('binds drag handlers for draggable events only', async () => {
    const { testApi } = await loadCalendarModule();
    const normalize = testApi.normalizeEvent as (value: any) => any;
    const createNode = testApi.createEventNode as (event: any, handlers: any) => FakeElement;

    const draggable = normalize({ id: 'd1', date: '2025-06-01', title: 'Draggable', userEvent: true });
    const handlers = { onOpen: vi.fn(), bindEventDrag: vi.fn() };
    const node = createNode(draggable, handlers);
    expect(handlers.bindEventDrag).toHaveBeenCalledTimes(1);
    expect(handlers.bindEventDrag.mock.calls[0][0]).toBe(node);
    expect(node.classList.contains('is-draggable')).toBe(true);

    handlers.bindEventDrag.mockClear();
    const nondrag = normalize({ id: 'd2', date: '2025-06-02', title: 'Static', userEvent: false });
    const nodeStatic = createNode(nondrag, handlers);
    expect(handlers.bindEventDrag).not.toHaveBeenCalled();
    expect(nodeStatic.classList.contains('is-draggable')).toBe(false);
  });
});
