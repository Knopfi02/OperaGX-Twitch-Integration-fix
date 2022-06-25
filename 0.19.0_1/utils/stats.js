// copypasted from desktop/common/resources/shared/toolkit/services

const getParamDescription = param => {
  if (typeof param === 'boolean') {
    return param ? 'Enabled' : 'Disabled';
  }
  if (typeof param === 'string') {
    return param;
  }
  return null;
};

const getPriority = important => important ?
    opr.statsPrivate.Priority.IMPORTANT :
    opr.statsPrivate.Priority.NORMAL;

export class StatsReporter {
  constructor(pathTokens) {
    this.pathTokens = pathTokens;
  }

  getStat(...tokens) {
    return [...this.pathTokens, ...tokens].map(getParamDescription).join('.');
  }

  recordAction(...tokens) {
    const stat = this.getStat(...tokens);
    opr.statsPrivate.recordAction(stat, opr.statsPrivate.Priority.NORMAL);
  }

  recordInt(name, value, important = false) {
    const stat = this.getStat(name);
    opr.statsPrivate.recordIntegerValue(
      stat,
      parseInt(value),
      getPriority(important)
    );
  }

  recordString(name, value, important = false) {
    const stat = this.getStat(name);
    opr.statsPrivate.recordStringValue(stat, value, getPriority(important));
  }

  recordBoolean(name, value, important = false) {
    const stat = this.getStat(name);
    opr.statsPrivate.recordBooleanValue(stat, value, getPriority(important));
  }
}
