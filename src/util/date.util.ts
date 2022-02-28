const { DateTime } = require('luxon');

export const formatDateDisplay = (date:any) => {
  const now = DateTime.local();
  const received = DateTime.fromISO(date, { zone: 'utc' }).toLocal();

  const diff = now.diff(received, ['years', 'months', 'days', 'hours']);

  if (now.hasSame(received, 'day')) {
    return received.toLocaleString(DateTime.TIME_SIMPLE);
  }
  if (now.minus({ days: 1 }).hasSame(received, 'day')) {
    return 'Yesterday';
  }

  if (diff.days > 1 && diff.days < 10) {
    return received.toRelative();
  }

  return received.toFormat('LL/dd/yy');
};

export const formatFullDate = (date:any) => {
  const received = DateTime.fromISO(date, { zone: 'utc' }).toLocal();
  return received.toFormat('dd LLL yyyy');
};

export const formatTimeOnly = (date:any) => {
  const received = DateTime.fromISO(date, { zone: 'utc' }).toLocal();
  return received.toFormat('t');
};

export const UTCtimestamp = () => {
  return DateTime.local().toUTC();
};

export const fullDatefromJS = (date:any) => {
  return DateTime.fromJSDate(date).toLocaleString(DateTime.DATE_FULL);
};

export const fullDatefromString = (date:any) => {
  return DateTime.fromFormat(date, 'MM/dd/yyyy').toLocaleString(
    DateTime.DATE_FULL
  );
};

export const fromStringToJSDate = (date:any) => {
  if (date === null || date.length === 0) {
    return '';
  }
  return DateTime.fromFormat(date, 'MM/dd/yyyy').toJSDate();
}

export const fromJSDateToString = (date:any) => {
  if (date === null || date.length === 0) {
    return '';
  }
  return DateTime.fromJSDate(date).toFormat('LL/dd/yyyy');
};
