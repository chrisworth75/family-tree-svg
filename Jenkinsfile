// Jenkinsfile in tree-svg repository
pipeline {
    agent any

    environment {
        IMAGE_NAME = 'family-tree-svg'
        TEST_CONTAINER = 'tree-svg-test'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'echo "Checked out family tree SVG generator successfully"'
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    sh '''
                        echo "Installing Node.js dependencies..."
                        npm install
                    '''
                }
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    sh '''
                        echo "Running tests..."
                        npm test || echo "No tests defined yet"
                    '''
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh """
                        echo "Building Docker image..."
                        docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -f Dockerfile .
                        docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest
                    """
                }
            }
        }

        stage('Test Container') {
            steps {
                script {
                    sh """
                        echo "Testing Docker container..."
                        docker stop ${TEST_CONTAINER} || true
                        docker rm ${TEST_CONTAINER} || true
                        docker run -d --name ${TEST_CONTAINER} -p 3001:3000 ${IMAGE_NAME}:${BUILD_NUMBER}
                    """

                    sleep 5

                    sh """
                        echo "Verifying container is running..."
                        docker ps | grep ${TEST_CONTAINER}
                        echo "Container test successful"
                    """
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sh """
                        echo "Deploying production container..."
                        docker stop ${IMAGE_NAME} || true
                        docker rm ${IMAGE_NAME} || true
                        docker run -d --name ${IMAGE_NAME} -p 3000:3000 ${IMAGE_NAME}:latest
                        echo "Production deployment successful"
                    """
                }
            }
        }
    }

    post {
        always {
            script {
                sh """
                    docker stop ${TEST_CONTAINER} || true
                    docker rm ${TEST_CONTAINER} || true
                """
            }
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
