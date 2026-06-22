import { EmployeeBalancesList } from "@/components/employee/EmployeeBalancesList";
import { TimeOffRequestForm } from "@/components/employee/TimeOffRequestForm";
import { MyRequestsList } from "@/components/employee/MyRequestsList";
import { CURRENT_EMPLOYEE_ID } from "@/lib/currentUser";

export default function EmployeePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Time-Off</h1>
        <p className="text-sm text-gray-500">Vista de empleado — solicita días y revisa tus balances.</p>
      </div>
      <EmployeeBalancesList employeeId={CURRENT_EMPLOYEE_ID} />
      <TimeOffRequestForm employeeId={CURRENT_EMPLOYEE_ID} />
      <MyRequestsList employeeId={CURRENT_EMPLOYEE_ID} />
    </main>
  );
}
