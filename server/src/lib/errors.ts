export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const Unauthorized = (message = 'Не авторизован') => new ApiError(401, message);
export const Forbidden = (message = 'Доступ запрещён') => new ApiError(403, message);
export const NotFound = (message = 'Не найдено') => new ApiError(404, message);
export const BadRequest = (message = 'Некорректный запрос') => new ApiError(400, message);
