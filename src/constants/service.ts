import type { ServiceItem } from "../interfaces/ServiceItem.interface";

export const statusDot: Record<ServiceItem['serviceStatus'], string> = {
  running: 'bg-success-color',
  building: 'bg-warning-color animate-pulse',
  starting: 'bg-warning-color animate-pulse',
  waiting: 'bg-secondary-text-color/40',
  stopped: 'bg-secondary-text-color/40',
  /*
   * stopped와 같은 회색을 쓰지 않는다. 멈춘 것은 그러기로 한 결과지만 offline은
   * Agent가 끊겨 아무것도 확인할 수 없는 구간이고, 사용자가 알아채야 하는 쪽이다.
   * 다만 사고는 아니므로 building처럼 깜빡이지는 않는다.
   */
  offline: 'bg-warning-color/60',
  failed: 'bg-danger-color',
  removed: 'bg-secondary-text-color/20',
};

export const statusLabel: Record<ServiceItem['serviceStatus'], string> = {
  running: 'Running',
  building: 'Building',
  starting: 'Starting',
  waiting: 'Waiting',
  stopped: 'Stopped',
  offline: 'Offline',
  failed: 'Failed',
  removed: 'Removed',
};

/**
 * 상태 글자색.
 *
 * 전에는 카드와 상세 화면이 각자 삼항 연산자를 늘어놓고 있었고, 두 곳의 조건이
 * 이미 서로 달랐다(카드는 starting/building을 회색으로 뒀다). 상태가 하나 늘 때마다
 * 두 군데를 고쳐야 하는 구조라 여기로 모은다. Record라 값이 빠지면 컴파일이 막는다.
 */
export const statusText: Record<ServiceItem['serviceStatus'], string> = {
  running: 'text-success-color',
  building: 'text-warning-color',
  starting: 'text-warning-color',
  waiting: 'text-secondary-text-color',
  stopped: 'text-secondary-text-color',
  offline: 'text-warning-color',
  failed: 'text-danger-color',
  removed: 'text-secondary-text-color',
};

export const presetLabel: Record<ServiceItem['serviceDeployPreset'], string> = {
  dockerfile: 'Dockerfile',
  compose: 'Compose',
  preset_nestjs: 'NestJS',
};
