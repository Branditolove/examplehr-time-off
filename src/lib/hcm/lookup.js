import { EMPLOYEES } from "./employees";
import { LOCATIONS } from "./locations";

export function getEmployeeName(id) {
  return EMPLOYEES.find((employee) => employee.id === id)?.name ?? id;
}

export function getLocationName(id) {
  return LOCATIONS.find((location) => location.id === id)?.name ?? id;
}
