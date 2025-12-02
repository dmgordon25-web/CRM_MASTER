const context = {
  settingsApi: null,
  dbClient: null,
  workflowModel: null,
  services: Object.create(null)
};

function normalizeServiceName(name){
  return typeof name === 'string' ? name.trim() : '';
}

export function initAppContext(initial = {}){
  if(initial && typeof initial === 'object'){
    if(initial.settings) setSettingsApi(initial.settings);
    if(initial.dbClient) setDbClient(initial.dbClient);
    if(initial.workflow) setWorkflowModel(initial.workflow);
    if(initial.services && typeof initial.services === 'object'){
      Object.keys(initial.services).forEach((key) => {
        registerService(key, initial.services[key]);
      });
    }
  }
  exposeShim();
  return context;
}

export function getAppContext(){
  return context;
}

function exposeShim(){
  if(typeof window === 'undefined') return;
  const shim = window.__APP_CONTEXT__ = window.__APP_CONTEXT__ || {};
  shim.getSettings = getSettingsApi;
  shim.setSettings = setSettingsApi;
  shim.getDbClient = getDbClient;
  shim.setDbClient = setDbClient;
  shim.getWorkflowModel = getWorkflowModel;
  shim.setWorkflowModel = setWorkflowModel;
  shim.getService = getService;
  shim.registerService = registerService;
  shim.getSelectionStore = getSelectionStore;
  shim.setSelectionStore = setSelectionStore;
  shim.getNotifier = getNotifier;
  shim.setNotifier = setNotifier;
  if(!window.AppContext){
    window.AppContext = shim;
  }
}

export function getSettingsApi(){
  if(context.settingsApi) return context.settingsApi;
  if(typeof window !== 'undefined' && window.Settings){
    context.settingsApi = window.Settings;
    exposeShim();
  }
  return context.settingsApi;
}

export function setSettingsApi(api){
  context.settingsApi = api || null;
  exposeShim();
  return context.settingsApi;
}

export function getDbClient(){
  return context.dbClient || null;
}

export function setDbClient(client){
  context.dbClient = client || null;
  exposeShim();
  return context.dbClient;
}

export function getWorkflowModel(){
  return context.workflowModel || null;
}

export function setWorkflowModel(model){
  context.workflowModel = model || null;
  exposeShim();
  return context.workflowModel;
}

export function registerService(name, service){
  const key = normalizeServiceName(name);
  if(!key) return;
  context.services[key] = service || null;
  exposeShim();
  return context.services[key];
}

export function getService(name){
  const key = normalizeServiceName(name);
  if(!key) return null;
  if(Object.prototype.hasOwnProperty.call(context.services, key)){
    return context.services[key];
  }
  return null;
}

export function setSelectionStore(store){
  return registerService('selectionStore', store || null);
}

export function getSelectionStore(){
  return getService('selectionStore');
}

export function setNotifier(service){
  return registerService('notifier', service || null);
}

export function getNotifier(){
  return getService('notifier');
}

export function setContactsApi(api){
  registerService('contactsApi', api);
}

export function getContactsApi(){
  return getService('contactsApi');
}

export function setPartnersApi(api){
  registerService('partnersApi', api);
}

export function getPartnersApi(){
  return getService('partnersApi');
}
