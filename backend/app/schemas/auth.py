"""认证相关的请求/响应模型"""

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    username: str          # 2-50 字符
    email: str             # 有效邮箱
    password: str          # 6-100 字符
    daily_available_hours: float = 4.0


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    daily_available_hours: float
    timezone: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
