resource "aws_iam_policy" "admin_access" {
  name = "admin-access"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["*"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "app_role" {
  name               = "app-role"
  assume_role_policy = aws_iam_policy.admin_access.arn
}

resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Web tier security group"

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_s3_bucket" "data" {
  bucket        = "my-app-data-bucket"
  force_destroy = true
}

resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  vpc_security_group_ids = [aws_security_group.web.id]
  iam_instance_profile   = aws_iam_role.app_role.name
}
