export function validateTask(model){
  const source = model && typeof model === 'object' ? model : {};
  const errors = {};

  const title = typeof source.title === 'string' ? source.title.trim() : '';
  if(!title){
    errors.title = 'required';
  }

  const dateFields = [
    source.date,
    source.due,
    source.dueDate,
    source.start,
    source.startDate
  ];

  let hasDate = false;
  for (const value of dateFields){
    if(value instanceof Date){
      if(!Number.isNaN(value.getTime())){
        hasDate = true;
        break;
      }
      continue;
    }
    if(typeof value === 'number'){
      if(Number.isFinite(value)){
        hasDate = true;
        break;
      }
      continue;
    }
    if(typeof value === 'string'){
      if(value.trim()){
        hasDate = true;
        break;
      }
    }
  }

  if(!hasDate){
    errors.date = 'required';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
